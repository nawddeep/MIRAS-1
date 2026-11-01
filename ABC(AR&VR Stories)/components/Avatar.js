export default function Avatar({ user, size = 40 }) {
  if (!user) return null;
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <span className="avatar" style={{ width: size, height: size, background: user.color, fontSize: size * 0.38 }} aria-hidden>{initials}</span>;
}
