import { useEffect, useRef } from "react";
import { addTicker } from "../lib/loop";
import { COLOR_HEX } from "../data/content";

type Mode = "default" | "link" | "native";

const BURST_COLORS = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];
const NATIVE_TARGETS = "input, textarea, select, [contenteditable], video, iframe";
const LINK_TARGETS = "a, button, [role=button], summary, label";
const FOLLOW = 0.22;
const CHIP_OFFSET = 22;

function burst(layer: HTMLElement, x: number, y: number) {
  BURST_COLORS.forEach((color, i) => {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    const bit = document.createElement("span");

    bit.className = "cursor-bit";
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.background = color;
    bit.style.setProperty("--dx", `${Math.cos(angle) * 34}px`);
    bit.style.setProperty("--dy", `${Math.sin(angle) * 34}px`);
    bit.style.setProperty("--rot", "90deg");

    layer.appendChild(bit);
    window.setTimeout(() => bit.remove(), 600);
  });
}

export default function Cursor() {
  const layerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const layer = layerRef.current;
    const dot = dotRef.current;
    const box = boxRef.current;
    const chip = chipRef.current;
    const label = labelRef.current;

    if (!finePointer || reducedMotion || !layer || !dot || !box || !chip || !label) {
      return;
    }

    const root = document.documentElement;
    root.classList.add("cursor-on");

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const follower = { x: pointer.x, y: pointer.y };
    let mode: Mode = "default";
    let visible = false;

    const setMode = (next: Mode, text = "", color = "") => {
      mode = next;
      layer.dataset.mode = next;
      layer.dataset.label = text ? "1" : "0";
      layer.style.setProperty("--cursor-accent", color || COLOR_HEX.gyellow);
      label.textContent = text;
    };

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      visible = true;
    };

    const onOver = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest(NATIVE_TARGETS)) {
        setMode("native");
        return;
      }

      const link = target.closest(LINK_TARGETS);
      if (link) {
        setMode("link", link.getAttribute("data-cursor-label") ?? "", link.getAttribute("data-cursor-color") ?? "");
      } else {
        setMode("default");
      }
    };

    const onDown = () => {
      layer.dataset.pressed = "1";
    };

    const onUp = (event: PointerEvent) => {
      layer.dataset.pressed = "0";
      burst(layer, event.clientX, event.clientY);
    };

    const onLeave = () => {
      visible = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    root.addEventListener("pointerleave", onLeave);

    const stop = addTicker(() => {
      follower.x += (pointer.x - follower.x) * FOLLOW;
      follower.y += (pointer.y - follower.y) * FOLLOW;

      dot.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
      box.style.transform = `translate(${follower.x}px, ${follower.y}px)`;
      chip.style.transform = `translate(${follower.x + CHIP_OFFSET}px, ${follower.y + CHIP_OFFSET}px)`;
      layer.style.opacity = visible && mode !== "native" ? "1" : "0";
    });

    return () => {
      stop();
      root.classList.remove("cursor-on");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={layerRef} className="cursor-layer" data-mode="default" data-label="0" aria-hidden="true">
      <div ref={boxRef} className="cursor-box">
        <span className="cursor-box-shape" />
      </div>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={chipRef} className="cursor-chip">
        <span ref={labelRef} className="cursor-chip-label" />
      </div>
    </div>
  );
}
