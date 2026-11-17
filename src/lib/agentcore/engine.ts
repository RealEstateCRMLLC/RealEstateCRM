/**
 * AgentCore NL Command Engine
 *
 * Translates natural-language commands into executable CRM actions.
 * Rule-based intent detection with optional LLM interpretation.
 * (Ported from aicrm, renamed from HyperNexus to AgentCore)
 */

import prisma from '@/lib/prisma';
import { completeWithActiveProvider } from '@/lib/ai/active-provider';
import { detectIntent, parseInterpretedIntent, INTERPRETED_INTENTS } from './intents';

async function callLLM(prompt: string, system?: string): Promise<string | null> {
  // Managed provider: switch in Settings -> AI Model Keys (OpenAI, Claude,
  // Gemini, DeepSeek, Qwen). Resolver falls back to DeepSeek automatically.
  return completeWithActiveProvider({ prompt, system });
}

export interface AgentCoreContext {
  workspaceId: string;
  userId: string;
}

export interface AgentCoreResult {
  success: boolean;
  intent?: string;
  action?: string;
  message: string;
  data?: unknown;
  usedLLM?: boolean;
}

type ActionExecutor = (ctx: AgentCoreContext, params: Record<string, string>) => Promise<AgentCoreResult>;

const updateLeadStage: ActionExecutor = async (ctx, params) => {
  const statusMap: Record<string, string> = {
    new: 'NEW', active: 'ACTIVE', hot: 'HOT', cold: 'COLD',
    'closed won': 'CLOSED_WON', won: 'CLOSED_WON', 'closed lost': 'CLOSED_LOST', lost: 'CLOSED_LOST', contacted: 'ACTIVE',
  };
  const rawStatus = params['stage'] || params['status'] || '';
  const status = statusMap[rawStatus.toLowerCase()];
  if (!status) return { success: false, message: `Unknown lead status: "${rawStatus}"` };

  const leadRef = params['lead'];
  if (!leadRef) return { success: false, message: 'Specify which lead (e.g., "update lead John to hot")' };

  const lead = await prisma.lead.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      OR: [
        { id: leadRef },
        { contact: { firstName: { contains: leadRef } } },
        { contact: { lastName: { contains: leadRef } } },
      ],
    },
    include: { contact: { select: { firstName: true, lastName: true } } },
  });
  if (!lead) return { success: false, message: `Lead "${leadRef}" not found` };

  await prisma.lead.update({ where: { id: lead.id }, data: { status } });
  await prisma.activity.create({ data: { leadId: lead.id, workspaceId: ctx.workspaceId, type: 'NOTE', content: `AgentCore: status updated to "${status}"`, userId: ctx.userId } });

  const leadName = `${lead.contact.firstName} ${lead.contact.lastName || ''}`.trim();
  return { success: true, message: `Lead "${leadName}" updated to "${status}"` };
};

const createTask: ActionExecutor = async (ctx, params) => {
  const title = params['title'] || params['task'];
  if (!title) return { success: false, message: 'Specify the task title' };
  const task = await prisma.task.create({
    data: { workspaceId: ctx.workspaceId, assignedToId: ctx.userId, title, description: params['description'] || null, dueDate: params['when'] ? new Date(params['when']) : null },
  });
  return { success: true, message: `Task "${title}" created`, data: task };
};

const listContacts: ActionExecutor = async (ctx) => {
  const contacts = await prisma.contact.findMany({
    where: { workspaceId: ctx.workspaceId }, orderBy: { updatedAt: 'desc' }, take: 20,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  return { success: true, message: `Found ${contacts.length} recent contacts`, data: contacts };
};

const summarizeWorkspace: ActionExecutor = async (ctx) => {
  const [contactCount, leadCount, hotLeads, taskCount, dealCount] = await Promise.all([
    prisma.contact.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.lead.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.lead.count({ where: { workspaceId: ctx.workspaceId, status: 'HOT' } }),
    prisma.task.count({ where: { workspaceId: ctx.workspaceId, status: { not: 'DONE' } } }),
    prisma.deal.count({ where: { workspaceId: ctx.workspaceId } }),
  ]);
  return { success: true, message: `Your workspace has ${contactCount} contacts, ${leadCount} leads (${hotLeads} hot), ${dealCount} deals, and ${taskCount} pending tasks.`, data: { contactCount, leadCount, hotLeads, taskCount, dealCount } };
};

const listTasks: ActionExecutor = async (ctx, params) => {
  const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };
  if (params['status'] === 'pending') where.status = { not: 'DONE' };
  if (params['status'] === 'completed') where.status = 'DONE';
  const tasks = await prisma.task.findMany({ where, orderBy: { dueDate: 'asc' }, select: { id: true, title: true, status: true, dueDate: true }, take: 20 });
  return { success: true, message: `Found ${tasks.length} tasks`, data: tasks };
};

const getContact: ActionExecutor = async (ctx, params) => {
  const ref = params['id'] || params['contact'];
  if (!ref) return { success: false, message: 'Specify a contact ID or name' };
  const contact = await prisma.contact.findFirst({
    where: { workspaceId: ctx.workspaceId, OR: [{ id: ref }, { firstName: { contains: ref } }, { lastName: { contains: ref } }] },
    include: { leads: { take: 5 }, Activity: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });
  if (!contact) return { success: false, message: `Contact "${ref}" not found` };
  return { success: true, message: `${contact.firstName} ${contact.lastName}`, data: contact };
};

const negotiate: ActionExecutor = async (ctx, params) => {
  const topic = params['topic'] || params['about'] || 'this offer';
  const advice = await callLLM(`Act as an expert real estate negotiation advisor. Give concrete, actionable advice on: ${topic}. Keep it under 200 words.`, 'You are an expert real estate negotiation advisor.');
  if (!advice) return { success: false, message: 'No AI key configured. Add one in Settings -> AI Models.' };
  await prisma.activity.create({ data: { type: 'NOTE', content: `AgentCore negotiation advice: ${advice}`, userId: ctx.userId, workspaceId: ctx.workspaceId } });
  return { success: true, message: advice };
};

const draftContent: ActionExecutor = async (_ctx, params) => {
  const kind = params['kind'] || params['channel'] || 'email';
  const topic = params['topic'] || params['about'] || 'follow up';
  const draft = await callLLM(`Draft a professional ${kind} for a real estate client about: ${topic}. Keep it concise and warm.`);
  if (!draft) return { success: false, message: 'No AI key configured. Add one in Settings -> AI Models.' };
  return { success: true, message: draft };
};

const listLeads: ActionExecutor = async (ctx, params) => {
  const status = (params['status'] || '').toUpperCase();
  const leads = await prisma.lead.findMany({
    where: { workspaceId: ctx.workspaceId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { contact: { select: { firstName: true, lastName: true } } },
  });
  if (leads.length === 0) return { success: true, message: status ? `No ${status} leads yet.` : 'No leads yet.', data: [] };
  const lines = leads.map((l) => `${l.contact.firstName} ${l.contact.lastName || ''} (${l.status})`.trim());
  return { success: true, message: `${leads.length} newest${status ? ` ${status}` : ''} leads: ${lines.join('; ')}`, data: leads };
};

const countHotLeads: ActionExecutor = async (ctx) => {
  const [count, top] = await Promise.all([
    prisma.lead.count({ where: { workspaceId: ctx.workspaceId, status: 'HOT' } }),
    prisma.lead.findMany({
      where: { workspaceId: ctx.workspaceId, status: 'HOT' },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      include: { contact: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  if (count === 0) return { success: true, message: 'You have 0 hot leads right now. Next step: work the newest leads and qualify them.', data: { count: 0 } };
  const names = top.map((l) => `${l.contact.firstName} ${l.contact.lastName || ''}`.trim()).join(', ');
  return {
    success: true,
    message: `You have ${count} hot lead${count === 1 ? '' : 's'}${names ? ` (most recent: ${names})` : ''}. Next step: call the most recent hot lead first, then log the outcome.`,
    data: { count },
  };
};

// Intent patterns live in ./intents (pure, unit-tested); this maps them to executors.
const RULE_EXECUTORS: Record<string, ActionExecutor> = {
  update_lead_stage: updateLeadStage,
  create_task: createTask,
  list_contacts: listContacts,
  summarize_workspace: summarizeWorkspace,
  list_tasks: listTasks,
  get_contact: getContact,
  negotiate,
  draft: draftContent,
};

export async function executeCommand(command: string, ctx: AgentCoreContext, opts: { useLLMFallback?: boolean } = {}): Promise<AgentCoreResult> {
  const detected = detectIntent(command);
  if (detected) {
    const executor = RULE_EXECUTORS[detected.intent];
    if (executor) {
      const result = await executor(ctx, detected.params);
      return { ...result, intent: detected.intent, action: detected.intent };
    }
  }
  if (opts.useLLMFallback) {
    const interpreted = await interpretWithLLM(command);
    if (interpreted) {
      const executor = INTERPRETED_EXECUTORS[interpreted.intent];
      if (executor) {
        const result = await executor(ctx, interpreted.params);
        return { ...result, intent: interpreted.intent, action: interpreted.intent, usedLLM: true };
      }
      if (interpreted.intent === 'unknown') {
        return { success: false, intent: 'unknown', message: interpreted.message || 'I did not understand that command.', usedLLM: true };
      }
    }
  }
  return { success: false, intent: 'unknown', message: 'I did not understand that command. Try:\n- "update lead [name] to hot"\n- "create a task to call John tomorrow"\n- "list contacts"\n- "summarize my workspace"' };
}

const INTERPRETED_EXECUTORS: Record<string, ActionExecutor> = {
  summarize_workspace: summarizeWorkspace,
  list_contacts: listContacts,
  list_leads: listLeads,
  count_hot_leads: countHotLeads,
  list_tasks: listTasks,
  get_contact: getContact,
};

async function interpretWithLLM(command: string) {
  const completion = await callLLM(
    command,
    `You interpret natural-language CRM commands. Respond with ONLY a JSON object:
{"intent": "<one of: ${INTERPRETED_INTENTS.join(', ')}>", "params": {"id": "<contact name if get_contact>", "status": "<lead status if list_leads>"}, "message": "<short note>"}
Pick the closest intent. Use unknown when nothing fits.`,
  );
  return parseInterpretedIntent(completion);
}
