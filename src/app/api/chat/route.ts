import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireWorkspaceAccess } from '@/lib/workspace-access';
import { buildChatContext } from '@/lib/rag';
import prisma from '@/lib/prisma';
import { enrollLeadInCampaignAction } from '@/lib/actions/campaign';
import { getActiveChatEndpoint, completeWithActiveProvider } from '@/lib/ai/active-provider';

export const maxDuration = 60;

/**
 * Dashboard AI chat (BYO-AI).
 *
 * Runs on the workspace's ACTIVE provider from Settings → AI Models
 * (getActiveChatEndpoint), like every other AI call site — it used to
 * be hardwired to DeepSeek via the Vercel AI SDK, which also never
 * worked in prod: the installed SDK set is mutually incompatible
 * (ai@3.1 core throws "Unhandled chunk type: response-metadata" on
 * @ai-sdk/openai@1.3 streams, and the un-awaited streamText promise
 * 500'd on .toAIStreamResponse). This route therefore speaks the
 * OpenAI-compatible Chat Completions API directly — one stable HTTP
 * contract for OpenAI / DeepSeek / Qwen / Gemini — executes tool
 * calls server-side in a bounded loop, and streams the final text
 * back in the AI stream format the useChat client parses.
 */

type ChatMessage = { role: string; content: string };

function textOf(message: any): string {
  if (typeof message?.content === 'string') return message.content;
  if (Array.isArray(message?.parts)) {
    return message.parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text ?? '').join('');
  }
  if (Array.isArray(message?.content)) {
    return message.content.filter((p: any) => p?.type === 'text').map((p: any) => p.text ?? '').join('');
  }
  return '';
}

/** Stream plain text back in the `0:"..."` line format useChat parses. */
function textStreamResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const step = 48;
      for (let i = 0; i < text.length; i += step) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(text.slice(i, i + step))}\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/x-unknown', 'X-Vercel-AI-Data-Stream': 'v1' },
  });
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const { messages } = body;
  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'messages must be an array' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const session = await getServerSession(authOptions);

  let access;
  try {
    access = await requireWorkspaceAccess(session);
  } catch (e) {
    return new Response('Unauthorized', { status: 401 });
  }

  const history: ChatMessage[] = messages
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m: any) => ({ role: m.role, content: textOf(m) }))
    .filter((m: ChatMessage) => m.content.trim().length > 0);

  const latestUserMessage = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  const workspaceContext = await buildChatContext({ workspaceSlug: access.workspaceSlug, query: latestUserMessage });

  const system =
    'You are the ultra-capable real estate AI assistant for Excel Legacy Realty. Your goal is to help agents dominate their local market. ' +
    'You have deep access to the CRM data and can perform actions on behalf of the user. ' +
    'Be proactive, professional, and efficient. Use the context below to inform your responses.\n\n' +
    workspaceContext;

  // ── Tool executors (unchanged behavior; workspace always comes from
  // the authenticated session, never from the model or the request).
  const executors: Record<string, (args: any) => Promise<unknown>> = {
    listCampaigns: async () => {
      const campaigns = await prisma.smartPlan.findMany({
        where: { workspaceId: access.workspaceId, isActive: true },
        select: { id: true, name: true, description: true },
      });
      return { campaigns };
    },
    enrollInCampaign: async ({ leadId, campaignId }) => enrollLeadInCampaignAction(leadId, campaignId),
    getLeadCount: async ({ status }) => {
      const count = await prisma.lead.count({
        where: { workspaceId: access.workspaceId, ...(status && { status }) },
      });
      return { count, status: status || 'ALL' };
    },
    createTask: async ({ title, description, dueDate, leadId }) => {
      if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return { error: 'Lead not found' };
      }
      const task = await prisma.task.create({
        data: {
          title,
          description,
          dueDate: dueDate ? new Date(dueDate) : null,
          workspaceId: access.workspaceId,
          assignedToId: access.userId,
          leadId,
        },
      });
      return { success: true, taskId: task.id, title: task.title };
    },
    searchContacts: async ({ query }) => {
      const contacts = await prisma.contact.findMany({
        where: {
          workspaceId: access.workspaceId,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
          ],
        },
        take: 5,
      });
      return { contacts };
    },
    createLead: async ({ firstName, lastName, email, phone, type, source, notes, tags }) => {
      const contact = await prisma.contact.create({
        data: {
          firstName,
          lastName: lastName || null,
          email: email || null,
          phone: phone || null,
          workspaceId: access.workspaceId,
        },
      });
      const lead = await prisma.lead.create({
        data: {
          status: 'NEW',
          score: 70,
          source: source || 'AI Assistant',
          type: type || 'BUYER',
          tags: tags || null,
          workspaceId: access.workspaceId,
          contactId: contact.id,
          userId: access.userId,
        },
      });
      if (notes) {
        await prisma.activity.create({
          data: {
            type: 'NOTE',
            content: `Note from AI Intake:\n"${notes}"`,
            workspaceId: access.workspaceId,
            userId: access.userId,
            leadId: lead.id,
          },
        });
      }
      return { success: true, leadId: lead.id, name: `${firstName} ${lastName || ''}`.trim() };
    },
    explainFeature: async ({ feature }) => {
      const explanations: Record<string, string> = {
        SEGMENTS: 'Segments (Workspaces) allow you to isolate leads into targeted lists like "Past Clients" or "Hot Leads". Change segments in the top header.',
        WORKFLOWS: 'Workflows are multi-step processes for automating complex tasks like "Foreclosure Intake" or "Offer Drafting".',
        SYNC_QUEUE: 'The Sync Queue pulls fresh foreclosure data from Legal News and MyPlus into your CRM.',
        INTELLIGENCE: 'Lead Intelligence uses AI to scrape social media and public records to enrich your lead data.',
        DEAL_HUB: 'The Deal Hub is where you coordinate transactions with Title, Mortgage, and Inspectors in a shared portal.',
      };
      return { explanation: explanations[feature] ?? 'Unknown feature.' };
    },
  };

  const tools = [
    { type: 'function', function: { name: 'listCampaigns', description: 'List available Drip Campaigns (Smart Plans) in the workspace.', parameters: { type: 'object', properties: {} } } },
    { type: 'function', function: { name: 'enrollInCampaign', description: 'Enroll a lead into a Drip Campaign (Smart Plan) to dispatch live SMS/emails.', parameters: { type: 'object', properties: { leadId: { type: 'string', description: 'The ID of the lead to enroll.' }, campaignId: { type: 'string', description: 'The ID of the campaign to enroll them in.' } }, required: ['leadId', 'campaignId'] } } },
    { type: 'function', function: { name: 'getLeadCount', description: 'Get the total number of leads in the current workspace.', parameters: { type: 'object', properties: { status: { type: 'string', description: 'Optional status to filter by.' } } } } },
    { type: 'function', function: { name: 'createTask', description: 'Create a new task for the agent.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'The title of the task.' }, description: { type: 'string', description: 'Detailed description.' }, dueDate: { type: 'string', description: 'ISO date string for the due date.' }, leadId: { type: 'string', description: 'Link to a specific lead ID.' } }, required: ['title'] } } },
    { type: 'function', function: { name: 'searchContacts', description: 'Search for contacts by name or email.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'The name or email fragment to search for.' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'createLead', description: 'Create a new lead/contact in the CRM.', parameters: { type: 'object', properties: { firstName: { type: 'string', description: 'The first name of the contact.' }, lastName: { type: 'string', description: 'The last name of the contact.' }, email: { type: 'string', description: 'The email address of the contact.' }, phone: { type: 'string', description: 'The phone number of the contact.' }, type: { type: 'string', enum: ['BUYER', 'SELLER'], description: 'Lead type (BUYER or SELLER).' }, source: { type: 'string', description: 'Where the lead came from.' }, notes: { type: 'string', description: 'Any initial notes or inquiry description.' }, tags: { type: 'string', description: 'Comma-separated hashtags to apply.' } }, required: ['firstName'] } } },
    { type: 'function', function: { name: 'explainFeature', description: 'Provide an explanation of how a specific CRM feature works.', parameters: { type: 'object', properties: { feature: { type: 'string', enum: ['SEGMENTS', 'WORKFLOWS', 'SYNC_QUEUE', 'INTELLIGENCE', 'DEAL_HUB'] } }, required: ['feature'] } } },
  ];

  const resolved = await getActiveChatEndpoint();
  const endpoint = resolved.endpoint;

  // The user explicitly picked a provider whose stored key cannot be
  // loaded (undecryptable or missing): say so plainly instead of
  // silently answering with a different provider.
  if (resolved.reason === 'no-key') {
    return new Response(
      JSON.stringify({
        error: `Your selected AI provider (${resolved.provider}) is chosen in Settings → AI Models, but its stored API key could not be loaded. Re-save the key there, or switch the Active Provider to one with a working key.`,
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Anthropic (not Chat-Completions-shaped) or nothing configured:
  // plain completion through the shared resolver, tools unavailable.
  if (!endpoint) {
    const fallback = await completeWithActiveProvider({
      system,
      prompt: history.map((m) => `${m.role}: ${m.content}`).join('\n'),
    });
    if (fallback === null) {
      return new Response(
        JSON.stringify({ error: 'No AI provider is configured. Add a provider key in Settings → AI Models.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return textStreamResponse(fallback);
  }

  const convo: any[] = [{ role: 'system', content: system }, ...history];
  let finalText = '';

  // Bounded tool loop: at most 3 model rounds so a misbehaving model
  // cannot loop tool calls (or provider spend) indefinitely.
  for (let round = 0; round < 3; round++) {
    const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${endpoint.apiKey}` },
      body: JSON.stringify({
        model: endpoint.model,
        messages: convo,
        tools,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return new Response(
        JSON.stringify({ error: `The selected AI provider (${endpoint.provider}) returned an error. Check the key in Settings → AI Models.`, detail }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const data = await res.json();
    const message = data.choices?.[0]?.message;
    if (!message) break;
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (toolCalls.length === 0) {
      finalText = message.content ?? '';
      break;
    }
    convo.push({ role: 'assistant', content: message.content ?? null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const name = call?.function?.name as string;
      let args: any = {};
      try { args = JSON.parse(call?.function?.arguments || '{}'); } catch { args = {}; }
      let result: unknown;
      try {
        const execute = executors[name];
        result = execute ? await execute(args) : { error: `Unknown tool: ${name}` };
      } catch (e) {
        result = { error: e instanceof Error ? e.message : 'Tool execution failed' };
      }
      convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
    if (round === 2) {
      finalText = 'I ran into a loop while working on that — please rephrase the request and I will try again.';
    }
  }

  return textStreamResponse(finalText || 'I could not produce a response. Please try again.');
}
