"use client";

import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { buildMailto, resolveTarget, validate, type Contact } from "@/lib/contact";

const target = resolveTarget({
  web3formsKey: process.env.NEXT_PUBLIC_WEB3FORMS_KEY,
  endpoint: process.env.NEXT_PUBLIC_CONTACT_ENDPOINT,
});

export function ContactForm({ email }: { email: string }) {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Contact, string>>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values: Contact = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      message: String(data.get("message") ?? ""),
    };
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus("Please fix the highlighted fields.");
      return;
    }

    if (!target) {
      window.location.href = buildMailto(email, values);
      setStatus("Your email app should open with your message ready to send.");
      return;
    }

    for (const [k, v] of Object.entries(target.fields)) data.set(k, v);
    setSending(true);
    setStatus("Sending your message…");
    try {
      const response = await fetch(target.url, { method: "POST", headers: { Accept: "application/json" }, body: data });
      if (!response.ok) throw new Error("The contact service returned an error.");
      form.reset();
      setStatus("Message sent. Thank you for getting in touch.");
    } catch {
      setStatus(`The message could not be sent. Please email ${email} directly.`);
    } finally {
      setSending(false);
    }
  }

  const field = (id: keyof Contact) => ({ "aria-invalid": Boolean(errors[id]) || undefined, "aria-describedby": errors[id] ? `contact-${id}-err` : undefined });
  const err = (id: keyof Contact) => (errors[id] ? <p className="cform-err" id={`contact-${id}-err`}>{errors[id]}</p> : null);

  return (
    <form className="cform" onSubmit={handleSubmit} noValidate>
      <div className="cform-row">
        <div className="cform-field">
          <label className="sr-only" htmlFor="contact-name">Your name</label>
          <input id="contact-name" name="name" placeholder="Your name" autoComplete="name" required maxLength={120} {...field("name")} />
          {err("name")}
        </div>
        <div className="cform-field">
          <label className="sr-only" htmlFor="contact-email">Email address</label>
          <input id="contact-email" name="email" type="email" placeholder="Email address" autoComplete="email" required maxLength={254} {...field("email")} />
          {err("email")}
        </div>
      </div>
      <div className="cform-field">
        <label className="sr-only" htmlFor="contact-message">Your message</label>
        <textarea id="contact-message" name="message" placeholder="Tell me about your project…" rows={4} required maxLength={5000} {...field("message")} />
        {err("message")}
      </div>
      <div className="cform-foot">
        <button className="btn btn-inverse" type="submit" disabled={sending} aria-busy={sending}>
          {sending ? "Sending…" : target ? "Send message" : "Prepare email"} <Send size={15} aria-hidden="true" />
        </button>
        <p className="cform-status" role="status" aria-live="polite">{status}</p>
      </div>
    </form>
  );
}
