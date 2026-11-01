import { useState } from 'react';
import { Modal } from './ui.jsx';
import { addDays, monthLabel, namesMatch, VERIFY_VALID_DAYS, verificationState } from '../trust.js';

export const PRIVACY_VERSION = '1.0';

// ---------------------------------------------------------------- privacy policy
// Prototype draft – have it reviewed by a lawyer (e.g. against India's DPDP Act, 2023) before launch.
export function PrivacyPolicy() {
  return (
    <article className="policy">
      <p className="muted small">Version {PRIVACY_VERSION} · Draft for the MIRAS prototype</p>
      <p>MIRAS connects travellers visiting Udaipur with each other and with verified local residents (“Local Friends”). This policy explains what we collect, what we share between a tourist and a Local Friend, and how both sides stay in control of their information.</p>

      <h4>1. What we collect</h4>
      <ul>
        <li><strong>Everyone:</strong> name, MIRAS username, profile details you choose to add (city, travel style, bio), the groups you join, itineraries, chat messages and poll votes.</li>
        <li><strong>Local Friends:</strong> area of Udaipur, languages, topics you show, your fee, and the result of identity verification (see section 2).</li>
        <li>We do <strong>not</strong> ask for or store bank details, card numbers or your exact home address.</li>
      </ul>

      <h4>2. Identity verification for Local Friends (DigiLocker)</h4>
      <ul>
        <li>Every Local Friend must verify their identity through DigiLocker before they can be listed, so tourists know they are meeting a real, verified person.</li>
        <li>Verification happens with your explicit consent on DigiLocker. MIRAS only keeps: <em>verified / not verified</em>, the document type (e.g. Aadhaar), a masked number (e.g. XXXX XXXX 1234) and the date.</li>
        <li>We never store a copy of your Aadhaar or other documents, your full ID number, address or date of birth.</li>
        <li>Tourists only see a “DigiLocker verified” badge – never your document details.</li>
      </ul>

      <h4>3. What a tourist and a Local Friend see about each other</h4>
      <ul>
        <li><strong>Before a request is accepted:</strong> the Local Friend’s public profile (name, photo/initials, area, languages, topics, fee, rating). The Local Friend sees the tourist’s name, home city, trip dates, group size and request message.</li>
        <li><strong>After acceptance:</strong> both can chat inside the trip’s group chat and see its itinerary. Other group members see the Local Friend’s public profile.</li>
        <li><strong>Phone numbers, email addresses and exact locations are never shared automatically.</strong> Share them yourself only if you choose to.</li>
        <li>Chats stay within the group. The Local Friend loses access when they leave or are removed from a group.</li>
      </ul>

      <h4>4. Payments</h4>
      <ul>
        <li>Local Friends are paid services; each Local Friend sets their own fee. In this prototype the fee is agreed between the tourist and the Local Friend and paid directly – MIRAS does not collect payment details.</li>
      </ul>

      <h4>5. Safety</h4>
      <ul>
        <li>Meet in public places first, keep conversations in the MIRAS chat, and never share OTPs, passwords or bank details with anyone.</li>
        <li>Either side can leave a trip at any time. Report concerns to MIRAS support; we may suspend accounts that put others at risk.</li>
      </ul>

      <h4>6. Your rights</h4>
      <ul>
        <li>You can view and edit your profile at any time, withdraw consent for verification (this removes your Local Friend listing), and ask us to delete your account and data.</li>
        <li>We keep data only as long as needed to run the service and meet legal requirements, and we don’t sell personal data.</li>
      </ul>

      <h4>7. In this prototype</h4>
      <p className="muted small">All data is stored only in your own browser. DigiLocker is simulated – no data is sent anywhere.</p>
    </article>
  );
}

export function PrivacyModal({ onClose }) {
  return <Modal title="Privacy policy – tourists & Local Friends" onClose={onClose}><PrivacyPolicy /></Modal>;
}

/** Required checkbox + link that opens the policy. */
export function PrivacyConsent({ checked, onChange, who = 'everyone' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <label className="check consent">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>I have read and agree to the{' '}
          <button type="button" className="link" onClick={() => setOpen(true)}>MIRAS Privacy Policy</button>
          {who === 'local' ? ', including identity verification and what tourists can see about me.' : ' – it protects both tourists and Local Friends.'}
        </span>
      </label>
      {open && <PrivacyModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function PrivacyLink({ children = 'Privacy policy' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="link" onClick={() => setOpen(true)}>{children}</button>
      {open && <PrivacyModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------- DigiLocker verification (mock)
export const DEMO_OTP = '123456';

/** Only shown while the verification is valid. Tourists see the badge and month – never the document. */
export function VerifiedBadge({ v, compact }) {
  if (verificationState(v) !== 'verified') return null;
  return (
    <span className="verified" title={`Identity verified with ${v.provider} in ${monthLabel(v.verifiedAt)}`}>
      ✔ {compact ? 'Verified' : `${v.provider} verified · ${monthLabel(v.verifiedAt)}`}
    </span>
  );
}

/** Button + status. Opens the simulated DigiLocker consent flow; stores only a verified flag + masked ID. */
export function DigiLockerVerify({ value, onChange, name }) {
  const [open, setOpen] = useState(false);
  if (value && value.status === 'review') {
    return (
      <div className="dl-status review">
        <span className="dl-logo">DL</span>
        <div>
          <strong>Sent for manual review</strong>
          <span className="muted small">The name on your {value.document} (“{value.nameOnDoc}”) didn’t match your profile name. You can create your account – you’ll be listed once MIRAS approves it.</span>
        </div>
        <button type="button" className="link" onClick={() => onChange(null)}>Try again</button>
      </div>
    );
  }
  if (value) {
    return (
      <div className="dl-status ok">
        <span className="dl-logo">DL</span>
        <div>
          <strong>Identity verified with DigiLocker</strong>
          <span className="muted small">{value.document} · {value.masked}{value.nameOnDoc ? ` · ${value.nameOnDoc}` : ''} · valid 12 months</span>
        </div>
        <button type="button" className="link" onClick={() => onChange(null)}>Remove</button>
      </div>
    );
  }
  return (
    <div className="dl-status">
      <span className="dl-logo">DL</span>
      <div>
        <strong>Verify your identity with DigiLocker</strong>
        <span className="muted small">Required for every Local Friend so tourists can trust who they meet. Only a “verified” badge and a masked ID are kept.</span>
      </div>
      <button type="button" className="btn primary sm" onClick={() => setOpen(true)}>Link DigiLocker</button>
      {open && <DigiLockerFlow name={name} onClose={() => setOpen(false)} onDone={(v) => { onChange(v); setOpen(false); }} />}
    </div>
  );
}

export function DigiLockerFlow({ name, onClose, onDone }) {
  const [step, setStep] = useState('mobile'); // mobile | otp | consent | working
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState('');
  const [docs, setDocs] = useState({ aadhaar: true, dl: false });
  const [docName, setDocName] = useState(name || ''); // demo: edit this to simulate a name mismatch
  const mobileOk = /^[6-9]\d{9}$/.test(mobile);

  const finish = () => {
    setStep('working');
    setTimeout(() => {
      const last4 = String(Math.floor(1000 + Math.random() * 9000));
      const at = new Date().toISOString();
      onDone({
        status: !name || namesMatch(name, docName) ? 'verified' : 'review', // mismatch -> manual review, not auto-approved
        expiresAt: addDays(at, VERIFY_VALID_DAYS),
        provider: 'DigiLocker',
        document: docs.aadhaar ? 'Aadhaar' : 'Driving Licence',
        masked: docs.aadhaar ? `XXXX XXXX ${last4}` : `RJ27 XXXXXXX${last4.slice(0, 2)}`,
        nameOnDoc: docName.trim() || undefined,
        verifiedAt: at,
      }); // the mobile number and OTP are NOT stored
    }, 900);
  };

  return (
    <Modal title="DigiLocker · demo" onClose={onClose}>
      <div className="dl-head">
        <span className="dl-logo big">DL</span>
        <div><strong>Sign in to DigiLocker</strong><span className="muted small">Simulated for this prototype – nothing is sent anywhere.</span></div>
      </div>
      <ol className="dl-steps">
        {['Mobile', 'OTP', 'Consent'].map((s, i) => <li key={s} className={['mobile', 'otp', 'consent'].indexOf(step) >= i || step === 'working' ? 'on' : ''}>{s}</li>)}
      </ol>

      {step === 'mobile' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); if (mobileOk) { setErr(''); setStep('otp'); } }}>
          <label>Mobile number linked to your Aadhaar
            <div className="prefix-input"><span>+91</span><input inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="10-digit mobile" autoFocus /></div>
          </label>
          <button className="btn primary block" disabled={!mobileOk}>Send OTP</button>
        </form>
      )}

      {step === 'otp' && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); if (otp === DEMO_OTP) { setErr(''); setStep('consent'); } else setErr('Incorrect OTP. (Demo OTP: 123456)'); }}>
          <p className="small">Enter the 6-digit OTP sent to +91 ••••••{mobile.slice(-4)}.</p>
          <input className="code-input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="••••••" autoFocus />
          <p className="muted small">Demo OTP: <strong>{DEMO_OTP}</strong></p>
          {err && <small className="err">{err}</small>}
          <div className="btnrow"><button type="button" className="btn ghost" onClick={() => setStep('mobile')}>Back</button><button className="btn primary" disabled={otp.length !== 6}>Verify OTP</button></div>
        </form>
      )}

      {step === 'consent' && (
        <div className="form">
          <p><strong>MIRAS</strong> is requesting access to verify your identity:</p>
          <label className="check"><input type="checkbox" checked={docs.aadhaar} onChange={(e) => setDocs((d) => ({ ...d, aadhaar: e.target.checked }))} /> Aadhaar – name & verification status</label>
          <label className="check"><input type="checkbox" checked={docs.dl} onChange={(e) => setDocs((d) => ({ ...d, dl: e.target.checked }))} /> Driving Licence – verification status</label>
          <label className="small">Name on document <span className="muted">(demo – change it to try a mismatch)</span>
            <input value={docName} onChange={(e) => setDocName(e.target.value)} />
          </label>
          {name && docName && !namesMatch(name, docName) && <small className="err">Doesn’t match your profile name “{name}” – this will go to manual review.</small>}
          <div className="explain small">
            MIRAS will keep only: <em>verified</em>, the document type, a masked number and today’s date. No document copy, full number, address or date of birth is stored. Verification is valid for 12 months. You can withdraw consent at any time.
          </div>
          <div className="btnrow">
            <button type="button" className="btn ghost" onClick={onClose}>Deny</button>
            <button type="button" className="btn primary" disabled={!docs.aadhaar && !docs.dl} onClick={finish}>Allow & verify</button>
          </div>
        </div>
      )}

      {step === 'working' && <div className="dl-working"><span className="spinner" /> Verifying with DigiLocker…</div>}
    </Modal>
  );
}
