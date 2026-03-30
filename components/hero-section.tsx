import { Activity, ArrowDownCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export function HeroSection() {
  return (
    <section id="home" className="container mx-auto px-4 py-16 md:py-24">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h1 className="text-[42px] leading-[50px] md:text-[72px] font-bold md:leading-[85px]">
            Private OTC flows for <span className="bg-[#FF6B7A] text-white px-3 py-1 inline-block">Bitcoin</span> settled on{" "}
            <span className="bg-[#2F81F7] text-white px-3 py-1 inline-block">Starknet</span>
          </h1>

          <p className="text-[#393939] text-[16px] md:text-[18px] font-medium leading-[28px] md:leading-[30px] max-w-xl">
            Build and submit BUY/SELL intents, trigger matching, and watch proof + TEE status update from backend APIs in real
            time.
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-7 pt-4">
            <Button
              asChild
              className="bg-[#0B0B0B] text-white hover:bg-black/90 rounded-lg py-5 px-8 md:py-[22px] md:px-[62px] text-base md:text-lg font-semibold h-auto w-full sm:w-auto sm:min-w-[240px]"
            >
              <a href="#intent-panel">
                <Activity className="w-5 h-5" />
                Open intent panel
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="bg-white border-[3px] border-black hover:bg-gray-50 rounded-lg py-5 px-8 md:py-[22px] md:px-[62px] text-base md:text-lg font-semibold h-auto w-full sm:w-auto sm:min-w-[240px]"
            >
              <a href="#live-state">
                <ArrowDownCircle className="w-5 h-5" />
                View live state
              </a>
            </Button>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <div className="relative w-full max-w-md aspect-square bg-[#FDB927] border-4 border-black rounded-3xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <Image
              src="/images/design-mode/63407fbdc2d4ac5270385fd4_home-he.png"
              alt="Illustrated character avatar"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
