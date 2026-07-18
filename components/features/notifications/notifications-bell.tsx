"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import type { ScuNotification } from "@/lib/auth/types";

export function NotificationsBell({ announce }: { announce: (message: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ScuNotification[]>([]);
  const unread = items.filter((item) => !item.read).length;

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .like("type", "scu_%")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as ScuNotification[]) || []);
  }, [user]);

  useEffect(() => {
    void refresh();
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`scu-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { void refresh(); },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const markRead = async (id?: string) => {
    if (!user) return;
    const supabase = createClient();
    if (id) {
      await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
    } else {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false).like("type", "scu_%");
    }
    await refresh();
  };

  return (
    <div className="notification-bell-wrap">
      <button
        type="button"
        className="icon-button notification"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          if (!user) {
            announce("Sign in to see notifications");
            return;
          }
          setOpen((value) => !value);
          if (!open) void refresh();
        }}
      >
        <Bell size={19} />
        {unread > 0 && <i />}
      </button>
      {open && user && (
        <div className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-head">
            <b>Notifications</b>
            <button type="button" onClick={() => void markRead()}>Mark all read</button>
          </div>
          <div className="notification-panel-list">
            {!items.length && <p className="empty-copy">You’re all caught up.</p>}
            {items.map((item) => (
              <div key={item.id} className={`notification-item ${item.read ? "" : "unread"}`}>
                {item.link ? (
                  <Link href={item.link} onClick={() => { void markRead(item.id); setOpen(false); }}>
                    <strong>{item.title}</strong>
                    {item.body && <small>{item.body}</small>}
                  </Link>
                ) : (
                  <button type="button" onClick={() => void markRead(item.id)}>
                    <strong>{item.title}</strong>
                    {item.body && <small>{item.body}</small>}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
