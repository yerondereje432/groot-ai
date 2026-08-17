"use client";
import { MarginCitation, type Citation } from "./MarginCitation";

export interface ChatMessageData {
  id: string; role: "student" | "assistant" | "system"; content: string; citations: Citation[];
}

export function ChatMessage({ message }: { message: ChatMessageData }) {
  if (message.role === "student") {
    return (
      <div className="flex justify-end mb-7 fade-up">
        <div className="max-w-[640px] rounded-[20px] rounded-br-[6px] px-4 py-3 text-[14.5px] leading-relaxed"
          style={{background:"linear-gradient(180deg, rgba(45,212,191,0.15), rgba(26,174,155,0.10))", border:"1px solid rgba(45,212,191,0.24)", color:"#E8FFF8", boxShadow:"0 4px 24px rgba(0,0,0,0.28)"}}>
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="mb-8 fade-up">
      <div className="max-w-[720px]">
        <div className="text-[10.5px] text-ink-faint font-mono mb-1.5 tracking-wider">GROOT</div>
        <div className="text-[15.5px] leading-[1.75] text-ink whitespace-pre-wrap" style={{textShadow:"0 1px 10px rgba(0,0,0,0.25)"}}>
          {message.content}
        </div>
        {message.citations.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.citations.map(c => <MarginCitation key={c.chunk_id} citation={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
