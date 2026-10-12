import { NoticeForm } from "@/components/admin/NoticeForm";
import { formatDateTime } from "@/config/site";
import { listNotifications } from "@/modules/notifications/service";

export default async function AdminNoticesPage() {
  const notes = await listNotifications(null, 20);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h1 className="text-2xl font-bold">Avisos</h1>
        <p className="mt-1 text-sm text-muted">Aparecem no sino de notificações de todos os visitantes.</p>
        <div className="mt-5">
          <NoticeForm />
        </div>
      </section>
      <section>
        <h2 className="font-semibold">Publicados</h2>
        {notes.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum aviso ainda.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="card p-4">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
                <p className="mt-1 text-xs text-faint">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
