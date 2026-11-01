import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { Avatar, Badge, Empty, Modal, useToast } from './ui.jsx';
import { displayTier, TIERS } from '../trust.js';
import { EventChip } from './Events.jsx';

const clock = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso) => {
  const d = new Date(iso), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

// ---------------------------------------------------------------- poll card (used in chat + polls tab)
export function PollCard({ g, poll, canVote, compact }) {
  const { state, dispatch, userByName } = useStore();
  const toast = useToast();
  const total = new Set(poll.options.flatMap((o) => o.votes)).size;
  const maxVotes = Math.max(0, ...poll.options.map((o) => o.votes.length));
  const mineAny = poll.options.some((o) => o.votes.includes(state.me));
  const canClose = !poll.closed && (poll.by === state.me || g.leader === state.me);
  const showResults = true; // results are always visible, like most group chats
  void mineAny;
  return (
    <div className={`poll ${compact ? 'compact' : ''} ${poll.closed ? 'closed' : ''}`}>
      <div className="poll-head">
        <span className="poll-icon">📊</span>
        <div>
          <strong>{poll.question}</strong>
          <span className="muted small">
            {poll.multi ? 'Pick any' : 'Pick one'} · {total} voter{total === 1 ? '' : 's'} · by {userByName(poll.by)?.name?.split(' ')[0]}
          </span>
        </div>
        {poll.closed && <Badge tone="neutral">Closed</Badge>}
      </div>
      <div className="poll-opts">
        {poll.options.map((o) => {
          const mine = o.votes.includes(state.me);
          const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
          const winner = poll.closed && o.votes.length === maxVotes && maxVotes > 0;
          return (
            <button key={o.id} className={`poll-opt ${mine ? 'mine' : ''} ${winner ? 'winner' : ''}`} disabled={!canVote || poll.closed}
              onClick={() => dispatch({ type: 'vote', id: g.id, pollId: poll.id, optionId: o.id })}>
              {showResults && <span className="poll-bar" style={{ width: `${pct}%` }} />}
              <span className={`poll-check ${poll.multi ? 'sq' : ''}`}>{mine ? '✓' : ''}</span>
              <span className="poll-text">{o.text}{winner ? ' 🏆' : ''}</span>
              {showResults && (
                <span className="poll-count">
                  <span className="stack">{o.votes.slice(0, 3).map((v) => <Avatar key={v} user={userByName(v)} size={18} />)}</span>
                  {o.votes.length} · {pct}%
                </span>
              )}
            </button>
          );
        })}
      </div>
      {(canClose || (!canVote && !poll.closed)) && (
        <div className="poll-foot">
          {!canVote && !poll.closed && <span className="muted small">Join the group to vote.</span>}
          {canClose && <button className="btn ghost xs" onClick={() => { dispatch({ type: 'closePoll', id: g.id, pollId: poll.id }); toast('Poll closed'); }}>Close poll</button>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- create poll
export function CreatePollModal({ g, onClose }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const clean = opts.map((o) => o.trim()).filter(Boolean);
  const ok = q.trim().length >= 3 && clean.length >= 2 && new Set(clean.map((c) => c.toLowerCase())).size === clean.length;
  const QUICK = [
    ['Which day works best?', ['Day 1', 'Day 2', 'Day 3']],
    ['Lunch spot?', ['Rooftop café', 'Thali place', 'Street food']],
    ['Morning start time?', ['7:00', '8:30', '10:00']],
  ];
  return (
    <Modal title="Create a poll" onClose={onClose}>
      <div className="tags">
        {QUICK.map(([qq, oo]) => <button key={qq} type="button" className="tag" onClick={() => { setQ(qq); setOpts(oo); }}>{qq}</button>)}
      </div>
      <form className="form" onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        dispatch({ type: 'createPoll', id: g.id, question: q.trim(), options: clean, multi });
        toast('Poll posted in the group chat');
        onClose();
      }}>
        <label>Question<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Where should we watch the sunset?" autoFocus /></label>
        <div className="label">Options</div>
        {opts.map((o, i) => (
          <div key={i} className="opt-row">
            <input value={o} onChange={(e) => setOpts((x) => x.map((y, j) => (j === i ? e.target.value : y)))} placeholder={`Option ${i + 1}`} />
            {opts.length > 2 && <button type="button" className="icon-btn" aria-label="Remove option" onClick={() => setOpts((x) => x.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        {opts.length < 6 && <button type="button" className="link left" onClick={() => setOpts((x) => [...x, ''])}>+ Add option</button>}
        <label className="check"><input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Allow multiple answers</label>
        {clean.length >= 2 && !ok && q.trim().length >= 3 && <small className="err">Options must be different.</small>}
        <button className="btn primary block" disabled={!ok}>Post poll</button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- chat
export function ChatPanel({ g, role }) {
  const { state, dispatch, userByName } = useStore();
  const [text, setText] = useState('');
  const [pollOpen, setPollOpen] = useState(false);
  const scrollRef = useRef(null);
  const boxRef = useRef(null);
  const isMember = role === 'leader' || role === 'member' || role === 'local';
  const messages = g.messages || [];
  // keep the newest message in view (scroll only the chat, not the page)
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);
  // when the chat opens, bring the whole chat box (with the input) into view
  useEffect(() => { boxRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, []);

  if (!isMember) {
    return <Empty title="Group chat is for members">{g.type === 'public' ? 'Join the group to chat with fellow travellers.' : 'Request to join – once the leader accepts, you can chat here.'}</Empty>;
  }

  const send = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    dispatch({ type: 'sendMessage', id: g.id, text: t });
    setText('');
  };

  let lastDay = '';
  return (
    <section className="chat card" ref={boxRef}>
      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m, i) => {
          const dl = dayLabel(m.at);
          const sep = dl !== lastDay ? <div className="chat-day" key={`d${i}`}><span>{dl}</span></div> : null;
          lastDay = dl;
          if (m.kind === 'system') return [sep, <div key={m.id} className="chat-sys">{m.text}</div>];
          const mine = m.by === state.me;
          const prev = messages[i - 1];
          const grouped = prev && prev.by === m.by && prev.kind !== 'system' && !sep;
          const user = userByName(m.by);
          const poll = m.kind === 'poll' ? (g.polls || []).find((p) => p.id === m.pollId) : null;
          return [sep, (
            <div key={m.id} className={`msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}`}>
              {!mine && <span className="msg-av">{!grouped && <Avatar user={user} size={30} />}</span>}
              <div className="msg-col">
                {!mine && !grouped && <span className="msg-name" style={{ color: user?.color }}>{user?.name}{m.by === g.leader ? ' · leader' : m.by === g.localFriend ? ` · local friend 🤝${displayTier(user) ? ` ${TIERS[displayTier(user)].emoji}` : ''}` : ''}</span>}
                {poll
                  ? <div className="bubble poll-bubble"><PollCard g={g} poll={poll} canVote compact /></div>
                  : m.kind === 'event' ? <div className="bubble event-bubble"><EventChip eventId={m.eventId} /></div>
                    : <div className="bubble">{m.text}</div>}
                <span className="msg-time">{clock(m.at)}</span>
              </div>
            </div>
          )];
        })}
      </div>
      <form className="chat-input" onSubmit={send}>
        <button type="button" className="btn ghost sm" onClick={() => setPollOpen(true)} title="Create a poll">📊 Poll</button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${g.name}…`} aria-label="Message" />
        <button className="btn primary sm" disabled={!text.trim()}>Send</button>
      </form>
      {pollOpen && <CreatePollModal g={g} onClose={() => setPollOpen(false)} />}
    </section>
  );
}
