// ── Wrapper de SweetAlert2 con el tema de la app ──
import Swal from "sweetalert2";

const BRAND = "#1e4786";
const DANGER = "#ef4444";
const CANCEL = "#64748b";

/**
 * Diálogo de confirmación de eliminación.
 * Devuelve true si el usuario confirma, false si cancela.
 */
export function confirmDelete(opts: {
  title?: string;
  text?: string;
  confirmText?: string;
}): Promise<boolean> {
  return Swal.fire({
    title: opts.title ?? "¿Estás seguro?",
    text: opts.text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Sí, eliminar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: DANGER,
    cancelButtonColor: CANCEL,
    reverseButtons: true,
    focusCancel: true,
  }).then((res) => res.isConfirmed);
}

/** Confirmación genérica (acciones que no son de borrado). */
export function confirmAction(opts: {
  title: string;
  text?: string;
  confirmText?: string;
  icon?: "warning" | "question" | "info";
}): Promise<boolean> {
  return Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: opts.icon ?? "question",
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Confirmar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: BRAND,
    cancelButtonColor: CANCEL,
    reverseButtons: true,
  }).then((res) => res.isConfirmed);
}
