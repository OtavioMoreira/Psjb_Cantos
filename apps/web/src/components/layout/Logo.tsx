import Image from "next/image";
import Link from "next/link";
import logo from "../../../public/logo.png";

export function Logo({ className = "h-10 w-auto sm:h-12", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="Início — Paróquia Catedral São João Batista" className="shrink-0">
      <Image src={logo} alt="Paróquia Catedral São João Batista" priority={priority} className={`logo-img ${className}`} sizes="160px" />
    </Link>
  );
}
