import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Upload } from "lucide-react";
import { apiUrl } from '@/lib/resolveApiBase';

export function TinyUploader({
  value,
  onChange,
  folder = "familyRecipe",
}: {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file) return;
    const contentType = file.type || "image/jpeg";
    try {
      setUploading(true);
      // 1) presign
      const r = await fetch(apiUrl("/api/uploads/sign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: folder, contentType }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { url, publicUrl } = await r.json();

      // 2) PUT to S3 presigned URL
      const put = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!put.ok) throw new Error("Upload failed");

      onChange(publicUrl);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-white font-medium">Photo (optional)</Label>
      <div className="flex items-center gap-2">
        <Input 
          ref={fileRef} 
          type="file" 
          accept="image/*" 
          onChange={(e) => { 
            const f = e.target.files?.[0]; 
            if (f) handleFile(f); 
          }} 
          className="bg-slate-800 border-slate-600 text-white" 
        />
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => fileRef.current?.click()} 
          disabled={uploading}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Upload className="w-4 h-4 mr-1"/>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="Recipe" className="w-20 h-20 object-cover rounded border border-slate-600"/>
          <code className="text-xs break-all text-slate-400 bg-slate-800 p-2 rounded">{value}</code>
        </div>
      ) : (
        <div className="text-slate-400 text-sm flex items-center gap-2">
          <ImageIcon className="w-4 h-4"/> 
          JPG/PNG/WEBP up to ~2MB
        </div>
      )}
      {error && <div className="text-red-400 text-sm">{error}</div>}
    </div>
  );
}