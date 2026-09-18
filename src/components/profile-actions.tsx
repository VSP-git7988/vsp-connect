"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Phone,
  Mail,
  MessageCircle,
  BriefcaseBusiness,
  Globe,
  Calendar,
  Share2,
  QrCode,
  X,
  Copy,
  ArrowUpRight,
} from "lucide-react";
import type { Profile, EventType } from "@/lib/types";
import { contactUrls } from "@/lib/contact";
export function track(profileId: string, event: EventType) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: profileId,
      event_type: event,
      referrer: document.referrer ? new URL(document.referrer).origin : null,
      source: new URLSearchParams(location.search).get("source"),
    }),
    keepalive: true,
  }).catch(() => {});
}
export function ProfileActions({
  profile: p,
  url,
}: {
  profile: Profile;
  url: string;
}) {
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    track(p.id, "profile_view");
  }, [p.id]);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: p.display_name, text: p.headline, url });
        setNotice("Profile shared.");
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("Profile link copied.");
      }
      track(p.id, "profile_shared");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setNotice(
          "Could not share automatically. Copy the profile URL from your address bar.",
        );
    }
  }
  const links = contactUrls(p);
  const actions = [
    {
      label: "Call",
      icon: Phone,
      url: links.call,
      event: "call_clicked",
    },
    {
      label: "Email",
      icon: Mail,
      url: links.email,
      event: "email_clicked",
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      url: links.whatsapp,
      event: "whatsapp_clicked",
    },
    {
      label: "LinkedIn",
      icon: BriefcaseBusiness,
      url: links.linkedin,
      event: "linkedin_clicked",
    },
    {
      label: "Website",
      icon: Globe,
      url: links.website,
      event: "website_clicked",
    },
  ] as const;
  return (
    <>
      <div className="primary-actions">
        <a
          className="button primary"
          href={`/api/profiles/${p.slug}/vcard`}
          onClick={() => track(p.id, "save_contact")}
        >
          <Download size={18} /> Save contact
        </a>
        <button className="button secondary" onClick={share}>
          <Share2 size={18} /> Share profile
        </button>
        <button
          className="button icon-button"
          aria-label="Show profile QR code"
          onClick={() => {
            dialog.current?.showModal();
            track(p.id, "qr_view");
          }}
        >
          <QrCode size={21} />
        </button>
      </div>
      <div className="action-grid">
        {actions.map(({ label, icon: Icon, url: href, event }) =>
          href ? (
            <a
              key={label}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={() => track(p.id, event)}
            >
              <Icon size={20} />
              <span>{label}</span>
              <ArrowUpRight size={12} />
            </a>
          ) : (
            <div
              key={label}
              className="unavailable"
              aria-label={`${label}: not configured`}
            >
              <Icon size={20} />
              <span>{label}</span>
              <small>Not added</small>
            </div>
          ),
        )}
      </div>
      <div className="meeting-panel">
        <div className="meeting-icon">
          <Calendar size={23} />
        </div>
        <div>
          <h3>Good conversations build great things.</h3>
          <p>
            {p.booking_url
              ? "Find a time to explore what’s possible."
              : "Meeting availability will be shared here."}
          </p>
        </div>
        {links.booking ? (
          <a
            className="button secondary"
            href={links.booking!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track(p.id, "booking_clicked")}
          >
            Book a meeting <ArrowUpRight size={16} />
          </a>
        ) : (
          <span className="quiet-label">Not configured</span>
        )}
      </div>
      <p className="action-notice" role="status">
        {notice}
      </p>
      <dialog
        ref={dialog}
        className="qr-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <button
          className="close-dialog"
          aria-label="Close QR code"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
        <div className="eyebrow">LET’S STAY CONNECTED</div>
        <h2>{p.display_name}</h2>
        <p>Scan to open my digital profile.</p>
        <Image
          unoptimized
          src={`/api/profiles/${p.slug}/qr`}
          alt={`QR code linking to ${p.display_name}'s profile`}
          width="256"
          height="256"
        />
        <p className="qr-url">{url}</p>
        <a
          className="button primary"
          href={`/api/profiles/${p.slug}/qr?download=1`}
          download={`${p.slug}-qr.svg`}
        >
          <Download size={16} /> Download QR
        </a>
        <button className="button secondary" onClick={share}>
          <Copy size={16} /> Share profile link
        </button>
      </dialog>
    </>
  );
}
