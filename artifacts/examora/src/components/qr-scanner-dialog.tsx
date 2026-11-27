import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, ScanLine, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractAdmissionId } from '@/lib/delivery';

type Controls = { stop: () => void };

/** Camera starts only after an explicit click. All tracks are stopped on close or unmount. Only same-origin admission IDs are accepted. */
export function QrScannerDialog({ open, onOpenChange, onAdmission }: { open: boolean; onOpenChange: (o: boolean) => void; onAdmission: (id: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const doneRef = useRef(false);
  const genRef = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  const onAdmissionRef = useRef(onAdmission);
  onAdmissionRef.current = onAdmission;

  const stopOwnedStream = (stream: MediaStream | null, v: HTMLVideoElement | null) => {
    stream?.getTracks().forEach((t) => t.stop());
    // Never detach a newer session's preview when an older permission prompt resolves.
    if (v && v.srcObject === stream) v.srcObject = null;
  };
  const stop = useCallback(() => {
    genRef.current += 1;
    try { controlsRef.current?.stop(); } catch { /* ignore */ }
    controlsRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((t) => t.stop());
    const v = videoRef.current;
    if (v && v.srcObject === stream) v.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      setState('idle');
      setMsg(null);
      setManual('');
      doneRef.current = false;
    }
  }, [open, stop]);
  useEffect(() => () => { openRef.current = false; stop(); }, [stop]);

  const accept = (raw: string) => {
    const r = extractAdmissionId(raw);
    if ('error' in r) {
      setMsg(r.error);
      return false;
    }
    doneRef.current = true;
    stop();
    onAdmissionRef.current(r.id);
    return true;
  };

  const startCamera = async () => {
    setMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setMsg('This browser cannot open a camera here. Paste the link or type the request ID instead.');
      return;
    }
    stop(); // invalidates any earlier session so only one reader exists
    const gen = ++genRef.current;
    const video = videoRef.current;
    const stale = () => gen !== genRef.current || !openRef.current || videoRef.current !== video;
    doneRef.current = false;
    setState('starting');
    let controls: Controls | null = null;
    let stream: MediaStream | null = null;
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (stale() || !video) return;
      const reader = new BrowserQRCodeReader();
      // Own the stream explicitly, including while the permission prompt is pending.
      // ZXing only decodes the element; late decoder cleanup cannot stop a newer stream.
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (stale()) { stopOwnedStream(stream, video); return; }
      streamRef.current = stream;
      video.srcObject = stream;
      controls = await reader.decodeFromVideoElement(video, (result) => {
        if (!result || doneRef.current || !openRef.current || gen !== genRef.current) return;
        accept(result.getText());
      });
      if (stale() || doneRef.current) {
        try { controls.stop(); } catch { /* ignore */ }
        stopOwnedStream(stream, video);
        if (streamRef.current === stream) streamRef.current = null;
        return;
      }
      controlsRef.current = controls;
      setState('scanning');
    } catch (e) {
      try { controls?.stop(); } catch { /* ignore */ }
      stopOwnedStream(stream, video);
      if (streamRef.current === stream) streamRef.current = null;
      if (gen !== genRef.current) return; // stale: never touch a newer session
      stop();
      if (!openRef.current) return;
      setState('error');
      setMsg(e instanceof Error && /permission|denied|notallowed/i.test(e.name + e.message) ? 'Camera permission was declined. Paste the link or type the request ID instead.' : 'The camera could not start. Paste the link or type the request ID instead.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-qr-scanner">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Scan a candidate code</DialogTitle>
          <DialogDescription>The code only locates an admission request. Confirm the person in front of you against the registered name before approving.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square overflow-hidden rounded-xl border bg-sidebar">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline data-testid="video-qr-scanner" />
          {state !== 'scanning' && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sidebar-foreground">
              <div className="space-y-3">
                {state === 'starting' ? <Loader2 className="mx-auto h-7 w-7 animate-spin" /> : state === 'error' ? <CameraOff className="mx-auto h-7 w-7" /> : <ScanLine className="mx-auto h-7 w-7" />}
                <p className="text-xs opacity-80">{state === 'starting' ? 'Waiting for camera permission' : 'The camera stays off until you choose to start it.'}</p>
                {state !== 'starting' && (
                  <Button size="sm" variant="secondary" onClick={startCamera} data-testid="button-start-camera"><Camera className="mr-1.5 h-4 w-4" />Start camera</Button>
                )}
              </div>
            </div>
          )}
          {state === 'scanning' && <div className="pointer-events-none absolute inset-10 rounded-lg border-2 border-accent/80" aria-hidden />}
        </div>
        {state === 'scanning' && (
          <Button variant="outline" size="sm" onClick={() => { stop(); setState('idle'); }} data-testid="button-stop-camera"><CameraOff className="mr-1.5 h-4 w-4" />Stop camera</Button>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); accept(manual); }}>
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste link or request ID" aria-label="Admission link or request ID" data-testid="input-admission-manual" />
          <Button type="submit" disabled={!manual.trim()} data-testid="button-open-admission"><ArrowRight className="h-4 w-4" /><span className="sr-only">Open request</span></Button>
        </form>
        {msg && <p role="alert" className="text-xs text-accent" data-testid="text-scan-error">{msg}</p>}
      </DialogContent>
    </Dialog>
  );
}
