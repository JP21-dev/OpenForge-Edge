"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Crosshair, Image as ImageIcon, Loader2, PenLine, Trash2, Undo2 } from "lucide-react";
import { useRepairStore } from "@/store/useRepairStore";
import { screwKey, type DeviceView, type ScrewGroup } from "@/lib/devices";
import { api, type StepPhoto } from "@/lib/api";

export const COLORS = ["#f5a524", "#22d3ee", "#e879f9", "#a3e635", "#fb7185", "#818cf8", "#facc15", "#34d399"];

interface Props {
  stepId: string;
  groups: ScrewGroup[];
  view?: DeviceView;
  removed: string[];
  onToggle: (key: string) => void;
  drawing: React.ReactNode;
}

export function StepVisual({ stepId, groups, view, removed, onToggle, drawing }: Props) {
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const [photos, setPhotos] = useState<StepPhoto[]>([]);
  const [show, setShow] = useState<"photo" | "drawing">("photo");
  const [placing, setPlacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listStepPhotos(deviceModel).then(setPhotos).catch(() => setPhotos([]));
  }, [deviceModel]);

  useEffect(() => setPlacing(false), [stepId]);

  const photo = photos.find((p) => p.step_id === stepId);
  const keys = groups.flatMap((g, gi) => Array.from({ length: g.count }, (_, i) => ({ key: screwKey(g.id, i), group: g, gi, i })));
  const unplaced = photo ? keys.filter((k) => !photo.markers[k.key]) : keys;
  const nextToPlace = unplaced[0];

  const replacePhoto = (p: StepPhoto) => setPhotos((prev) => [...prev.filter((x) => x.step_id !== p.step_id), p]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("device_model", deviceModel);
    form.append("step_id", stepId);
    try {
      replacePhoto(await api.uploadStepPhoto(form));
      setShow("photo");
      if (groups.length) setPlacing(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveMarkers = async (markers: StepPhoto["markers"]) => {
    if (!photo) return;
    replacePhoto({ ...photo, markers });
    try {
      replacePhoto(await api.saveStepMarkers(photo.id, markers));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placing || !photo || !nextToPlace) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const markers = { ...photo.markers, [nextToPlace.key]: [x, y] as [number, number] };
    saveMarkers(markers);
    if (unplaced.length === 1) setPlacing(false);
  };

  const undo = () => {
    if (!photo) return;
    const placed = keys.filter((k) => photo.markers[k.key]);
    const last = placed[placed.length - 1];
    if (!last) return;
    const { [last.key]: _gone, ...rest } = photo.markers;
    saveMarkers(rest);
    setPlacing(true);
  };

  const remove = async () => {
    if (!photo || !confirm("Delete the photo for this step?")) return;
    await api.deleteStepPhoto(photo.id).catch(() => undefined);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  const showPhoto = photo && (show === "photo" || !view);
  const btn = "flex h-11 items-center gap-2 rounded-lg px-3 text-base font-semibold";

  return (
    <div className="space-y-2">
      {photo && view && (
        <div role="tablist" className="flex gap-1 rounded-xl bg-bench-raised p-1">
          {(["photo", "drawing"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={show === v}
              onClick={() => setShow(v)}
              className={`${btn} flex-1 justify-center ${show === v ? "bg-bench-accent text-black" : "text-bench-muted"}`}
            >
              {v === "photo" ? <ImageIcon className="size-5" aria-hidden /> : <PenLine className="size-5" aria-hidden />}
              {v === "photo" ? "Photo" : "Drawing"}
            </button>
          ))}
        </div>
      )}

      {showPhoto ? (
        <figure className="space-y-2">
          <div
            onClick={place}
            className={`relative mx-auto overflow-hidden rounded-2xl border-2 ${placing ? "cursor-crosshair border-bench-accent" : "border-bench-border"}`}
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
          >
            <img src={api.stepPhotoUrl(photo.id)} alt="Photo of this step" draggable={false} className="block size-full object-cover" />
            {keys.map(({ key, gi, group, i }) => {
              const pos = photo.markers[key];
              if (!pos) return null;
              const out = removed.includes(key);
              const color = COLORS[gi % COLORS.length];
              return (
                <button
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!placing) onToggle(key);
                  }}
                  aria-label={`${group.label} ${group.length} screw ${i + 1}${out ? ", removed" : ""}`}
                  className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] text-xs font-black text-black shadow-lg"
                  style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, borderColor: color, background: out ? "rgba(0,0,0,0.5)" : color, opacity: out ? 0.6 : 1 }}
                >
                  {out ? "✓" : ""}
                </button>
              );
            })}
          </div>
          {placing && nextToPlace ? (
            <p className="flex items-center gap-2 rounded-xl bg-bench-accent/15 p-3 text-lg" role="status">
              <Crosshair className="size-5 shrink-0 text-bench-accent" aria-hidden />
              Tap where the{" "}
              <span className="inline-block size-4 rounded-full" style={{ background: COLORS[nextToPlace.gi % COLORS.length] }} aria-hidden />
              <b>
                {nextToPlace.group.label} {nextToPlace.group.length}
              </b>{" "}
              screw {nextToPlace.i + 1} of {nextToPlace.group.count} is ({keys.length - unplaced.length + 1}/{keys.length}).
            </p>
          ) : (
            <figcaption className="text-center text-base text-bench-muted">
              Your photo of this step{unplaced.length ? ` · ${unplaced.length} screw${unplaced.length === 1 ? "" : "s"} not placed` : ""}. Tap a screw to mark it removed.
            </figcaption>
          )}
        </figure>
      ) : (
        drawing
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => fileRef.current?.click()} disabled={busy} className={`${btn} bg-bench-raised hover:bg-bench-border disabled:opacity-40`}>
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
          {photo ? "Replace photo" : "Add photo of this step"}
        </button>
        {photo && groups.length > 0 && (
          <button
            onClick={() => {
              setShow("photo");
              if (!placing && !unplaced.length) {
                const stepKeys = new Set(keys.map((k) => k.key));
                saveMarkers(Object.fromEntries(Object.entries(photo.markers).filter(([k]) => !stepKeys.has(k))));
              }
              setPlacing((v) => !v);
            }}
            className={`${btn} ${placing ? "bg-bench-accent text-black" : "bg-bench-raised hover:bg-bench-border"}`}
          >
            <Crosshair className="size-5" aria-hidden />
            {placing ? "Done placing" : unplaced.length ? "Place screws" : "Re-place screws"}
          </button>
        )}
        {photo && placing && (
          <button onClick={undo} className={`${btn} bg-bench-raised hover:bg-bench-border`}>
            <Undo2 className="size-5" aria-hidden />
            Undo
          </button>
        )}
        {photo && (
          <button onClick={remove} aria-label="Delete photo" className={`${btn} ml-auto text-bench-muted hover:text-bench-fault`}>
            <Trash2 className="size-5" aria-hidden />
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      {error && <p className="text-base text-bench-fault">{error}</p>}
    </div>
  );
}
