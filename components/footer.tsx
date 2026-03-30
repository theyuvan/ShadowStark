import { Globe, Send, Camera, PlayCircle, Briefcase, Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Footer() {
  return (
    <footer className="bg-black text-white py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 md:mb-16 relative">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <div className="h-16 w-16 rounded-full border-4 border-black bg-[#FFF3D9]" />

              <div className="w-full flex-1 bg-white border-4 border-black rounded-3xl py-4 px-4 md:py-6 md:px-8 flex flex-col md:flex-row items-center gap-4 md:gap-6">
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl md:text-2xl font-bold text-black">Get release notes for backend updates</h3>
                </div>

                <div className="relative w-full md:w-auto md:min-w-[400px] lg:min-w-[480px]">
                  <Input
                    type="email"
                    placeholder="Enter your email for build and API updates"
                    className="border-4 border-black rounded-xl px-4 md:px-6 h-14 md:h-16 pr-32 md:pr-44 text-base md:text-lg placeholder:text-gray-500"
                  />
                  <Button className="absolute right-2 top-2 bottom-2 bg-black text-white hover:bg-black/90 rounded-[10px] px-6 md:px-10 text-sm md:text-base font-semibold whitespace-nowrap h-auto">
                    Subscribe
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-white flex-shrink-0" />
                <span className="text-lg md:text-xl font-bold">ShadowFlowBTC++</span>
              </div>
              <p className="text-gray-400 mb-6 text-sm leading-relaxed">
                Private OTC flows with backend-backed intent submission, matching, and proof verification.
              </p>
              <div className="flex gap-3">
                <a
                  href="#"
                  className="w-10 h-10 bg-[#2F81F7] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <Globe className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-[#2F81F7] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <Send className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-[#FF6B7A] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <Camera className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-[#FF6B7A] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <PlayCircle className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-[#FF6B7A] rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <Briefcase className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-4">Sections</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="#home" className="hover:text-white transition-colors">
                    Overview
                  </a>
                </li>
                <li>
                  <a href="#intent-panel" className="hover:text-white transition-colors">
                    OTC intents
                  </a>
                </li>
                <li>
                  <a href="#live-state" className="hover:text-white transition-colors">
                    Live state
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Trades
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Matches
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4">Backend APIs</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    /api/otc/intents
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    /api/otc/trades
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    /api/otc/matches
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    /api/otc/execution-logs
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    /api/otc/proofs/latest
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    /api/chain/state
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4">Contact us</h3>
              <ul className="space-y-3 text-gray-400 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href="mailto:hello@john.com" className="hover:text-white transition-colors">
                    team@shadowflowbtc.dev
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <a href="tel:246234-4643" className="hover:text-white transition-colors">
                    +1-555-0109
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            <p>ShadowFlowBTC++ frontend wired to backend OTC and proof routes.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
