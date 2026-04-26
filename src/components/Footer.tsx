import { Link } from "@/i18n/routing";
import Image from "next/image";

const productLinks = [
  { href: "/", label: "Home" },
  { href: "/causes", label: "Explore Causes" },
  { href: "/about", label: "About" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/5 bg-white dark:border-white/10 dark:bg-zinc-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <Image
                src="/proof-of-heart-logo.svg"
                alt="ProofOfHeart"
                width={120}
                height={36}
                className="h-7 w-auto"
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              A decentralized launchpad where the community validates causes and contributions are
              accounted for on-chain.
            </p>
          </div>

          <div className="flex flex-wrap gap-8">
            <div>
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Product</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {productLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Links</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href="https://github.com/Iris-IV/ProofOfHeart-frontend"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://stellar.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Stellar
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-black/5 pt-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} ProofOfHeart. All rights reserved.</p>
          <p>Built with Next.js + Stellar</p>
        </div>
      </div>
    </footer>
  );
}
