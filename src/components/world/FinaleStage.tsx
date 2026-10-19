import { RollText } from "../ui";

export default function FinaleStage() {
  return (
    <div data-stage="finale" className="relative h-[78vh] min-h-[520px] border-b-[3px] border-ink">
      <div className="pointer-events-none relative mx-auto flex h-full max-w-7xl flex-col justify-center px-8">
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-muted uppercase">End of the deck</p>
        <h2 className="mt-4 max-w-md text-h2 heading-shadow heading-shadow-green">You've seen every card.</h2>
        <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink/80">
          Ten cards, one chapter. Brush the pile with your cursor, then draw your own.
        </p>
        <a
          href="#/login?mode=signup"
          className="hard-button group pointer-events-auto mt-8 inline-flex w-fit items-center gap-3 bg-gyellow px-6 py-3.5 font-display text-base font-extrabold text-ink"
        >
          <RollText>Join the deck</RollText>
        </a>
      </div>
    </div>
  );
}
