import StaffHeader from "./StaffHeader";

/** Staff pages get the app navigation; the public pages (homepage, customer deals) don't. */
export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <StaffHeader />
      <main className="flex-1">{children}</main>
    </>
  );
}
