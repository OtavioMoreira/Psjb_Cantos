import { initials } from "@/lib/store";

/** Foto da pessoa (vinda da API) ou as iniciais no círculo verde. */
export function UserAvatar({ name, photoUrl, size = 48, className = "" }: { name: string; photoUrl?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-solid font-serif font-semibold text-[#FFFDF8] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto do Blob/API, já no tamanho final
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
