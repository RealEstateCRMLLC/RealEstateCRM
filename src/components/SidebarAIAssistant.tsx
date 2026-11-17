'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

type Message = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
};

/**
 * Workflows sidebar assistant.
 *
 * This panel used to SIMULATE replies with canned text behind an
 * "Active Copilot" badge. It now runs every message through AgentCore
 * (/api/agentcore), which executes against the live workspace — rules
 * first, active-provider LLM interpretation as fallback — and renders
 * the real result. Nothing here pretends: a failed call says so and
 * states that nothing was executed.
 */
export default function SidebarAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'assistant',
      text: 'Hi! I am your CRM Assistant, connected to your live workspace through the provider in Settings → AI Models. Ask me to summarize your pipeline, list leads, create tasks, or update a lead — commands really run.',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      sender: 'user',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/agentcore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: textToSend, useLLM: true }),
      });
      const data = await res.json().catch(() => null);
      const reply = !res.ok
        ? (data?.error || `The assistant could not run that (HTTP ${res.status}). If you were signed out, refresh and sign in again.`)
        : (data?.message || data?.response || 'Done — but the assistant returned no message. Try rephrasing the command.');
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(36).substring(7), sender: 'assistant', text: reply },
      ]);
    } catch {
      toast.error('Could not reach the CRM assistant. Check your connection and try again.');
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: 'assistant',
          text: 'I could not reach the assistant service just now. Nothing was executed — please try again.',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-full border-l border-border relative z-30">
      {/* Trigger Rail (Collapsable Strip) */}
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 bg-muted/50 hover:bg-muted border-r border-border h-full flex flex-col items-center py-6 gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <span className="text-lg">✨</span>
        <span className="text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-rl] select-none">
          AI Assistant
        </span>
      </button>

      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="w-80 bg-background h-full flex flex-col animate-in slide-in-from-right duration-250">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <h4 className="font-bold text-sm">CRM Assistant</h4>
                <p className="text-[10px] text-green-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Live · runs real CRM commands
                </p>
              </div>
            </div>
            <button type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Close
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">No messages yet. Ask the AI assistant for help.</div> : (messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col max-w-[85%] ${
                  m.sender === 'user' ? 'ml-auto items-end' : 'items-start'
                }`}
              >
                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight mb-1">
                  {m.sender === 'user' ? 'Agent' : 'Assistant'}
                </span>
                <div
                  className={`p-3 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed border ${
                    m.sender === 'user'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/30 border-border text-foreground'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            )))}
            {isTyping && (
              <div className="flex gap-1 items-center pl-2">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="p-3 bg-muted/10 border-t border-border/50 flex flex-wrap gap-1">
            <button type="button"
              onClick={() => handleSend('show my pipeline summary')}
              className="px-2 py-1 bg-background hover:bg-muted border border-border text-[9px] font-bold uppercase rounded-lg text-muted-foreground hover:text-foreground"
            >
              📊 Pipeline
            </button>
            <button type="button"
              onClick={() => handleSend('how many hot leads do I have and what should I do next?')}
              className="px-2 py-1 bg-background hover:bg-muted border border-border text-[9px] font-bold uppercase rounded-lg text-muted-foreground hover:text-foreground"
            >
              🔥 Hot Leads
            </button>
            <button type="button"
              onClick={() => handleSend('list my top 3 newest leads')}
              className="px-2 py-1 bg-background hover:bg-muted border border-border text-[9px] font-bold uppercase rounded-lg text-muted-foreground hover:text-foreground"
            >
              📝 Newest Leads
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-4 border-t border-border flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={isTyping}
              className="px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
