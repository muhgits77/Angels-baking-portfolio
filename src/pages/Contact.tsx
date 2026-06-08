import { useState } from 'react';
import { useInquiries } from '../hooks/useInquiries';
import { toast } from 'sonner';

const SITE = {
  email: 'hello@angelsbaking.com',
  instagram: '@angelsbaking',
};

const TYPES = ['Custom Cake', 'Weekly Bread Box', 'Special Occasion', 'Catering / Event', 'Just Saying Hello'];

export function Contact() {
  const { submit } = useInquiries();
  const [form, setForm] = useState({ name: '', email: '', phone: '', inquiry_type: 'Custom Cake', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill name, email and message');
      return;
    }
    setSubmitting(true);
    try {
      await submit({ ...form, bake_title: null });
      setSent(true);
      toast.success('Inquiry received — thank you. Angel will be in touch soon.');
      setTimeout(() => {
        setForm({ name: '', email: '', phone: '', inquiry_type: 'Custom Cake', message: '' });
        setSent(false);
      }, 1600);
    } catch (e) {
      toast.error('Could not submit. Please email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-12 pb-20">
      <div className="container max-w-2xl">
        <div className="text-center mb-9">
          <div className="uppercase tracking-[3.5px] text-xs text-[#C17F59]">Let’s make something beautiful</div>
          <h1 className="mt-2">Contact &amp; Inquiries</h1>
          <p className="lead mt-3">For custom cakes, weekly subscriptions, events, or just to say hello.</p>
        </div>

        <div className="contact-card">
          {!sent ? (
            <form onSubmit={handleSubmit} className="inquiry-form">
              <div className="row">
                <div>
                  <label className="block text-xs tracking-widest text-[#C9B39E] mb-1.5">NAME</label>
                  <input className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your name" required />
                </div>
                <div>
                  <label className="block text-xs tracking-widest text-[#C9B39E] mb-1.5">EMAIL</label>
                  <input type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@email.com" required />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs tracking-widest text-[#C9B39E] mb-1.5">PHONE (OPTIONAL)</label>
                <input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(206) 555-0192" />
              </div>

              <div className="mt-4">
                <label className="block text-xs tracking-widest text-[#C9B39E] mb-1.5">I’M INTERESTED IN</label>
                <select className="input" value={form.inquiry_type} onChange={e => update('inquiry_type', e.target.value)}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="mt-4">
                <label className="block text-xs tracking-widest text-[#C9B39E] mb-1.5">MESSAGE</label>
                <textarea className="input" rows={5} value={form.message} onChange={e => update('message', e.target.value)} placeholder="Hi Angel, I’d love to order..." required />
              </div>

              <button type="submit" disabled={submitting} className="btn w-full bg-white text-[#3F2A1D] hover:bg-[#F8F4ED] mt-5 py-3.5 text-base font-semibold">
                {submitting ? 'Sending…' : 'Send Inquiry to Angel'}
              </button>
            </form>
          ) : (
            <div className="py-8">
              <div className="text-4xl mb-4">💛</div>
              <div className="text-2xl tracking-tight font-semibold text-white mb-2">Thank you.</div>
              <p className="text-[#C9B39E]">I’ll reply personally within a day or two.</p>
            </div>
          )}

          <div className="mt-8 pt-7 border-t border-white/20 text-sm text-[#C9B39E]">
            {SITE.instagram} &nbsp;·&nbsp; <a href={`mailto:${SITE.email}`} className="underline hover:text-white">{SITE.email}</a>
          </div>
        </div>

        <div className="text-center text-xs text-[#8B6F5C] mt-9">Prefer the old fashioned way? Call or text the studio — the number is on the back of every bread bag.</div>
      </div>
    </div>
  );
}
