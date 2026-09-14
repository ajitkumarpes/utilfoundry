import { ArrowRight, Leaf, LockKeyhole, MoreHorizontal, ShieldCheck, Sparkles, Zap } from "lucide-react";

export function InfoRail({ isAiTool }: { isAiTool: boolean }) {
  return (
    <aside className="insights-column" aria-label="Tool information">
      <section className="info-card"><h2>Why use this tool?</h2><div className="benefit"><span className="benefit-icon green"><ShieldCheck size={21} /></span><div><strong>100% Free</strong><small>No account required</small></div></div><div className="benefit"><span className="benefit-icon blue"><LockKeyhole size={21} /></span><div><strong>Your files stay private</strong><small>Processed securely and not stored</small></div></div><div className="benefit"><span className="benefit-icon purple"><Zap size={21} /></span><div><strong>Fast & reliable</strong><small>Get results in seconds</small></div></div><div className="benefit"><span className="benefit-icon orange"><Leaf size={21} /></span><div><strong>{isAiTool ? "No paid API" : "No tracking payloads"}</strong><small>{isAiTool ? "Open-source local model" : "Simple, transparent processing"}</small></div></div></section>
      <section className="info-card formats-card"><div className="side-card-title"><h2>Supported formats</h2><a href="#formats">View all</a></div><div className="format-grid"><span><b className="fmt orange">J</b>JPG</span><span><b className="fmt blue">P</b>PNG</span><span><b className="fmt green">W</b>WebP</span><span><b className="fmt purple">A</b>AVIF</span><span><b className="fmt gray">G</b>GIF</span><span><b className="fmt gray">T</b>TIFF</span></div></section>
      <section className="info-card tips-card"><h2><Sparkles size={20} /> Tips for best results</h2><ul><li>For photos, 60–80% gives a strong quality/size balance.</li><li>Use WebP for smaller sizes on modern websites.</li><li>Keep PNG when transparency matters.</li><li>No watermark is added to your output.</li></ul></section>
      <section className="feedback-card"><span><MoreHorizontal size={22} /></span><div><strong>Have feedback?</strong><small>Help us build better tools</small></div><ArrowRight size={17} /></section>
    </aside>
  );
}
