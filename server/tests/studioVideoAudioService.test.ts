import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractStudioVideoAudio } from "../services/studioVideoAudioService";

const execFileAsync = promisify(execFile);

describe("Studio video audio extraction", () => {
  let fixtureRoot: string;
  let tempRoot: string;
  let videoBuffer: Buffer;

  beforeAll(async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "studio-video-audio-fixture-"));
    tempRoot = await mkdtemp(join(tmpdir(), "studio-video-audio-work-"));
    const fixturePath = join(fixtureRoot, "fixture.webm");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=black:s=320x180:r=12",
      "-f", "lavfi",
      "-i", "sine=frequency=440:sample_rate=16000",
      "-t", "1",
      "-c:v", "libvpx",
      "-c:a", "libopus",
      fixturePath,
    ]);
    videoBuffer = await readFile(fixturePath);
  });

  afterAll(async () => {
    await Promise.all([
      rm(fixtureRoot, { recursive: true, force: true }),
      rm(tempRoot, { recursive: true, force: true }),
    ]);
  });

  it("extracts a compact audio-only payload and removes all temporary files", async () => {
    const audio = await extractStudioVideoAudio(videoBuffer, "video/webm", { tempRoot });

    expect(audio.byteLength).toBeGreaterThan(0);
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("removes temporary media when FFmpeg extraction fails", async () => {
    await expect(
      extractStudioVideoAudio(Buffer.from("not-a-video"), "video/webm", { tempRoot }),
    ).rejects.toThrow("Studio video audio extraction failed");

    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });
});