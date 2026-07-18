"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";

type Article = { id: string; title: string; slug: string; content: string; category: string };

const FALLBACK: Article[] = [
  { id: "1", slug: "multistream", title: "Building a multistream", category: "scu", content: "Open Multistream, add channels from the Streams drawer, drag panes to reorder, and save watchspaces from the header menu. Share a link with ?streams= or ?load= for saved workspaces." },
  { id: "2", slug: "notifications", title: "Notifications", category: "scu", content: "Enable event reminders, go-live alerts, browser push, and optional email in Settings → Notifications. Email only sends when Email notifications is on." },
  { id: "3", slug: "follows", title: "Following creators", category: "scu", content: "Follow from any streamer profile. Follows sync to your account and power Discover personalization and go-live alerts." },
  { id: "4", slug: "events", title: "Events & reminders", category: "scu", content: "Save events from event pages. Remind me also saves the event and schedules in-app / push / email reminders near start time." },
  { id: "5", slug: "clips", title: "Clips playback", category: "scu", content: "Clips play in Twitch’s embed. SCU shows duration/elapsed for context; seeking uses Twitch’s own controls." },
];

export function HelpPage({ announce }: { announce: (message: string) => void }) {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>(FALLBACK);
  const [active, setActive] = useState(FALLBACK[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("knowledge_articles")
      .select("id, title, slug, content, category")
      .eq("category", "scu")
      .eq("published", true)
      .then(({ data }) => {
        if (data?.length) {
          setArticles(data as Article[]);
          setActive(data[0] as Article);
        }
      });
  }, []);

  const submitTicket = async () => {
    if (!user) {
      announce("Sign in to contact support");
      return;
    }
    if (subject.trim().length < 3 || message.trim().length < 3) {
      announce("Add a subject and message");
      return;
    }
    setSending(true);
    const supabase = createClient();
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject: subject.trim(), status: "open", priority: "normal" })
      .select("id")
      .single();
    if (error || !ticket) {
      announce(error?.message || "Couldn’t create ticket");
      setSending(false);
      return;
    }
    await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      content: message.trim(),
      is_internal: false,
    });
    setSubject("");
    setMessage("");
    setSending(false);
    announce("Support ticket sent");
  };

  return (
    <div className="page help-page">
      <div className="page-header">
        <div>
          <span className="eyebrow purple">Help</span>
          <h1>Help & support</h1>
          <p>Guides for Multistream, notifications, follows, and events.</p>
        </div>
      </div>
      <div className="help-layout">
        <aside className="help-nav">
          {articles.map((article) => (
            <button key={article.id} type="button" className={active.slug === article.slug ? "active" : ""} onClick={() => setActive(article)}>
              <BookOpen size={16} /> {article.title}
            </button>
          ))}
        </aside>
        <article className="help-article">
          <h2>{active.title}</h2>
          <p>{active.content}</p>
          <Link href="/discover" className="button secondary">Back to Discover</Link>
        </article>
        <section className="help-contact">
          <h2><LifeBuoy size={18} /> Contact support</h2>
          <input aria-label="Subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea aria-label="Message" placeholder="How can we help?" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          <button type="button" className="button primary" disabled={sending} onClick={() => void submitTicket()}>
            {sending ? "Sending…" : "Send ticket"}
          </button>
        </section>
      </div>
    </div>
  );
}
