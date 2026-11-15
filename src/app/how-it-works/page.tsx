import type { Metadata } from "next";
import { Actors } from "@/components/explainer/actors";
import { Architecture } from "@/components/explainer/architecture";
import { DataModel } from "@/components/explainer/data-model";
import { EvaluationPlayground } from "@/components/explainer/evaluation-playground";
import { FailureModes } from "@/components/explainer/failure-modes";
import { Hero } from "@/components/explainer/hero";
import { HttpExchanges } from "@/components/explainer/http-exchange";
import { Metrics } from "@/components/explainer/metrics";
import { Permissions } from "@/components/explainer/permissions";
import { PollingSim } from "@/components/explainer/polling-sim";
import { Roadmap } from "@/components/explainer/roadmap";
import { Callout, Section } from "@/components/explainer/section";
import { Toc } from "@/components/explainer/toc";
import { TradeOff } from "@/components/explainer/tradeoff";
import { WritePath } from "@/components/explainer/write-path";

export const metadata: Metadata = { title: "How it works · SistemSaya Flags" };

export default function HowItWorksPage() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-8 xl:grid-cols-[minmax(0,1fr)_180px]">
      <div className="min-w-0">
        <section id="overview" className="scroll-mt-6 pb-12">
          <Hero />
        </section>

        <Section id="actors" eyebrow="Who's involved" title="People write, services read">
          <Actors />
        </Section>

        <Section
          id="architecture"
          eyebrow="Architecture"
          title="An API, a database, and an SDK in every service"
          lead="Pick a scenario to see what moves."
        >
          <Architecture />
        </Section>

        <Section
          id="write-path"
          eyebrow="Changing a flag"
          title="One change, one transaction"
          lead="The change, its audit row and the new version are saved together, or not at all."
        >
          <WritePath />
        </Section>

        <Section
          id="read-path"
          eyebrow="Getting updates"
          title="Services check for changes every 15 seconds"
          lead="No change means an empty 304."
        >
          <div className="space-y-6">
            <PollingSim />
            <HttpExchanges />
            <Callout tone="demo" title="In this demo">
              Polls run every 5 s, and the 304 check is one database lookup instead of an in-memory cache.
            </Callout>
          </div>
        </Section>

        <Section
          id="evaluation"
          eyebrow="Evaluating a flag"
          title="Four rules, first match wins"
          lead="Change the situation and see which rule decides."
        >
          <EvaluationPlayground />
        </Section>

        <Section id="data-model" eyebrow="Data model" title="Five tables, one small JSON file">
          <DataModel />
        </Section>

        <Section
          id="failures"
          eyebrow="When things fail"
          title="Client requests never wait on the flag service"
        >
          <FailureModes />
        </Section>

        <Section id="trade-off" eyebrow="Trade-off" title="Why polling, not push">
          <TradeOff />
        </Section>

        <Section id="permissions" eyebrow="Who can change what" title="Teams own their flags">
          <Permissions />
        </Section>

        <Section
          id="delivery"
          eyebrow="Delivery plan"
          title="Pilot in 3 weeks, adoption by week 6"
          lead="Badges show what the live demo already covers."
        >
          <Roadmap />
        </Section>

        <Section id="success" eyebrow="Measuring success" title="How we'll know it works">
          <Metrics />
        </Section>
      </div>

      <aside>
        <Toc />
      </aside>
    </div>
  );
}
