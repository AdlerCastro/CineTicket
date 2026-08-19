export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className='container py-8'>{children}</div>;
}
