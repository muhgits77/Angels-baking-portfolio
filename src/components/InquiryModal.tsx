import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useInquiries } from '../hooks/useInquiries';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillBake?: string | null;   // title of a specific bake
}

const INQUIRY_TYPES = [
  'Custom Cake',
  'Weekly Bread Box',
  'Special Occasion',
  'Order a Signature Bake',
  'Catering / Event',
  'Just Saying Hello',
];

export function InquiryModal({ isOpen, onClose, prefillBake }: InquiryModalProps) {
  const { submit } = useInquiries();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    inquiry_type: prefillBake ? 'Order a Signature Bake' : 'Custom Cake',
    message: prefillBake ? `Hi Angel, I would love to order the ${prefillBake}. ` : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Please fill out name, email and a short message.');
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        inquiry_type: form.inquiry_type,
        message: form.message.trim(),
        bake_title: prefillBake || null,
      });
      setSuccess(true);
      toast.success('Inquiry sent! Angel will get back to you soon.', { duration: 6000 });
      setTimeout(() => {
        onClose();
        // reset for next time
        setForm({ name: '', email: '', phone: '', inquiry_type: 'Custom Cake', message: '' });
        setSuccess(false);
      }, 1450);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not send inquiry right now. Please email hello@angelsbaking.com directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="studio-modal" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.985 }}
            className="studio-panel max-w-[520px] my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="studio-header">
              <div className="font-semibold tracking-tight text-lg">Send an Inquiry</div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F1E9DC]"><X size={20} /></button>
            </div>

            {success ? (
              <div className="p-10 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-[#F1E9DC] flex items-center justify-center mb-5 text-3xl">💌</div>
                <div className="text-2xl font-semibold tracking-tight mb-2">Thank you.</div>
                <p className="text-[#6B5344]">Angel will reply within a day or two. Looking forward to baking for you.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-[1.5px] text-[#8B6F5C] mb-1.5 ml-0.5">YOUR NAME</label>
                    <input className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Alex Rivera" required />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[1.5px] text-[#8B6F5C] mb-1.5 ml-0.5">EMAIL</label>
                    <input type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@family.com" required />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-[1.5px] text-[#8B6F5C] mb-1.5 ml-0.5">PHONE (OPTIONAL)</label>
                  <input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(206) 555-0142" />
                </div>

                <div>
                  <label className="block text-xs tracking-[1.5px] text-[#8B6F5C] mb-1.5 ml-0.5">WHAT ARE YOU LOOKING FOR?</label>
                  <select
                    className="input"
                    value={form.inquiry_type}
                    onChange={e => update('inquiry_type', e.target.value)}
                  >
                    {INQUIRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs tracking-[1.5px] text-[#8B6F5C] mb-1.5 ml-0.5">MESSAGE</label>
                  <textarea
                    className="input"
                    value={form.message}
                    onChange={e => update('message', e.target.value)}
                    placeholder={prefillBake ? `I'd love the ${prefillBake} for...` : "Hi Angel, I'm planning..."}
                    rows={4}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary w-full py-3.5 text-base mt-2 disabled:opacity-70"
                >
                  {submitting ? 'Sending to Angel…' : 'Send Inquiry'}
                </button>

                <p className="text-center text-[11px] text-[#8B6F5C] pt-1">
                  Or email <a href="mailto:hello@angelsbaking.com" className="underline">hello@angelsbaking.com</a> directly
                </p>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
