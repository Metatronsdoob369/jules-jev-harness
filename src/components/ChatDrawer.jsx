import React, { useState } from 'react';
import { MessageSquare, Send, Paperclip, X, Bot, User, FileText, Image as ImageIcon } from 'lucide-react';

export default function ChatDrawer({ isOpen, onClose, activeModel }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'JEV.AI',
      text: 'Greetings. I am Jev.ai, your DAG traffic controller and project teammate. How can Jules and I orchestrate your tasks today?',
      timestamp: '11:40'
    },
    {
      id: 2,
      sender: 'JULES',
      text: 'Code execution harness connected. I am ready to write code, build components, and run verification tests.',
      timestamp: '11:41'
    }
  ]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);

  if (!isOpen) return null;

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    const userMsg = {
      id: Date.now(),
      sender: 'OPERATOR',
      text: input,
      attachments: [...attachments],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachments([]);

    // Simulate response from Jev.ai & Jules
    setTimeout(() => {
      const resp = {
        id: Date.now() + 1,
        sender: 'JEV.AI',
        text: `Understood. Processing request using ${activeModel.name}. Decomposing into worker sub-tasks now.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, resp]);
    }, 1000);
  };

  const handleSimulateUpload = () => {
    const mockFiles = ['architecture_spec.png', 'data_schema.json', 'design_reference.pdf'];
    const randomFile = mockFiles[Math.floor(Math.random() * mockFiles.length)];
    setAttachments((prev) => [...prev, randomFile]);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 h-[500px] bg-canvas-deck border border-optic-cyan/40 rounded-xl shadow-[0_0_25px_rgba(0,229,255,0.15)] flex flex-col font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-canvas-bezel border-b border-canvas-bezel flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-optic-cyan" />
          <span className="font-bold text-slate-100">JULES & JEV.AI CHAT COCKPIT</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-canvas-base">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col space-y-1 ${
              m.sender === 'OPERATOR' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
              <span className="font-bold text-optic-bright">{m.sender}</span>
              <span>•</span>
              <span>{m.timestamp}</span>
            </div>
            <div
              className={`p-2.5 rounded-lg max-w-[85%] ${
                m.sender === 'OPERATOR'
                  ? 'bg-optic-cyan/20 text-slate-100 border border-optic-cyan/40'
                  : m.sender === 'JEV.AI'
                  ? 'bg-canvas-deck text-slate-200 border border-wal-emerald/30'
                  : 'bg-canvas-bezel text-slate-200 border border-optic-bright/30'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 pt-1 border-t border-slate-700 space-y-1">
                  {m.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center space-x-1 text-[10px] text-optic-bright">
                      <ImageIcon className="w-3 h-3" />
                      <span className="truncate">{file}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Attached items preview */}
      {attachments.length > 0 && (
        <div className="px-3 py-1.5 bg-canvas-bezel border-t border-canvas-bezel flex items-center space-x-2 overflow-x-auto">
          {attachments.map((file, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-canvas-panel text-optic-bright border border-optic-bright/30 text-[10px] flex items-center space-x-1">
              <span>{file}</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-white"
                onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
              />
            </span>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-2.5 bg-canvas-bezel border-t border-canvas-bezel flex items-center space-x-2">
        <button
          type="button"
          onClick={handleSimulateUpload}
          className="p-1.5 rounded bg-canvas-panel text-slate-400 hover:text-optic-cyan transition-colors"
          title="Attach files or specs"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Talk to Jules & Jev.ai..."
          className="flex-1 bg-canvas-base border border-canvas-bezel focus:border-optic-cyan rounded px-2.5 py-1.5 text-slate-200 outline-none text-xs"
        />
        <button
          type="submit"
          className="p-1.5 bg-optic-cyan text-canvas-deep rounded font-bold hover:bg-optic-bright transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
