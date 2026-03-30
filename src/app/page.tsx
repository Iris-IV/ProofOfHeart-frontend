import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">

        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 leading-tight">
            A decentralized launchpad where the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-teal-500">
              community
            </span>{" "}
            validates a cause
          </h1>

          <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed max-w-3xl mx-auto">
            ProofOfHeart empowers everyday people to rally behind the causes they believe in.
            By leveraging blockchain transparency and community-driven governance, it removes
            gatekeepers from the fundraising process and puts trust back where it belongs: in the hands of the people.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/causes"
              className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Explore Causes
            </Link>
            <Link
              href="/submit"
              className="px-8 py-3 border-2 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold rounded-full transition-all duration-200"
            >
              Submit a Cause
            </Link>
          </div>
        </div>

        {/* Mission Section */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center p-6 rounded-lg bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Community First</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Causes are validated by the people, not by a corporate board.</p>
          </div>

          <div className="text-center p-6 rounded-lg bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Radical Transparency</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Every decision and transaction lives on-chain for anyone to verify.</p>
          </div>

          <div className="text-center p-6 rounded-lg bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Permissionless</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Anyone can propose, support, or challenge a cause.</p>
          </div>

          <div className="text-center p-6 rounded-lg bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Trust Through Code</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Smart contracts enforce the rules, removing the need for intermediaries.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
