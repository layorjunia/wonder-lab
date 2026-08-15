// Silhouettes for the passport's empty slots, cut from the app's own photos.
//
// Uses Vision's foreground-instance segmentation — the same "lift subject"
// machinery as Photos — so nothing is downloaded and nothing is hand-drawn.
// Each species photo becomes a small flat-color cutout PNG: the SHAPE of the
// animal with none of the answer's detail, which is exactly what an
// uncollected passport slot wants to show.
//
// Guardrails, because segmentation fails confidently on museum shots and
// busy scenes:
//   * coverage < 3%  -> the mask grabbed almost nothing; SKIP
//   * coverage > 88% -> the mask grabbed the whole frame; SKIP
// Skipped ids keep the app's ghost treatment. The contact sheet is still
// reviewed by eye before anything ships — a clean mask of the WRONG subject
// passes every numeric check.
//
//   swiftc -O tools/gen_cutouts.swift -o .work/gen_cutouts
//   .work/gen_cutouts img/cut img/*.jpg
import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
guard args.count > 2 else {
    print("usage: gen_cutouts <outDir> <images...>"); exit(2)
}
let outDir = URL(fileURLWithPath: args[1], isDirectory: true)
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let ctx = CIContext()
// Slate, matching --text-faint's family; the app dims it further with opacity.
let fill = CIColor(red: 0.42, green: 0.51, blue: 0.62, alpha: 1.0)
let MAXDIM: CGFloat = 320

var ok = 0, skipped = 0

for path in args.dropFirst(2) {
    let url = URL(fileURLWithPath: path)
    let id = url.deletingPathExtension().lastPathComponent
    autoreleasepool {
        guard let src = CIImage(contentsOf: url) else {
            print("SKIP \(id) unreadable"); skipped += 1; return
        }
        let handler = VNImageRequestHandler(url: url)
        let req = VNGenerateForegroundInstanceMaskRequest()
        do { try handler.perform([req]) } catch {
            print("SKIP \(id) vision: \(error.localizedDescription)"); skipped += 1; return
        }
        guard let obs = req.results?.first else {
            print("SKIP \(id) no-subject"); skipped += 1; return
        }
        guard let maskBuf = try? obs.generateScaledMaskForImage(
                forInstances: obs.allInstances, from: handler) else {
            print("SKIP \(id) no-mask"); skipped += 1; return
        }
        let mask = CIImage(cvPixelBuffer: maskBuf)

        // coverage = mean of the mask
        let avg = mask.applyingFilter("CIAreaAverage",
            parameters: [kCIInputExtentKey: CIVector(cgRect: mask.extent)])
        var px = [UInt8](repeating: 0, count: 4)
        ctx.render(avg, toBitmap: &px, rowBytes: 4,
                   bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
                   format: .RGBA8, colorSpace: nil)
        let coverage = Double(px[0]) / 255.0
        if coverage < 0.03 { print("SKIP \(id) coverage \(coverage)"); skipped += 1; return }
        if coverage > 0.88 { print("SKIP \(id) coverage \(coverage)"); skipped += 1; return }

        // flat color through the mask, transparent elsewhere
        let solid = CIImage(color: fill).cropped(to: src.extent)
        let cut = solid.applyingFilter("CIBlendWithMask", parameters: [
            kCIInputMaskImageKey: mask,
            kCIInputBackgroundImageKey: CIImage(color: CIColor.clear).cropped(to: src.extent),
        ])

        let scale = MAXDIM / max(src.extent.width, src.extent.height)
        let small = cut.applyingFilter("CILanczosScaleTransform", parameters: [
            kCIInputScaleKey: min(1.0, scale), kCIInputAspectRatioKey: 1.0,
        ])

        guard let cg = ctx.createCGImage(small, from: small.extent) else {
            print("SKIP \(id) render"); skipped += 1; return
        }
        let rep = NSBitmapImageRep(cgImage: cg)
        guard let png = rep.representation(using: .png, properties: [:]) else {
            print("SKIP \(id) png"); skipped += 1; return
        }
        do {
            try png.write(to: outDir.appendingPathComponent(id + ".png"))
            print("OK \(id) \(String(format: "%.2f", coverage))")
            ok += 1
        } catch { print("SKIP \(id) write"); skipped += 1 }
    }
}
print("\(ok) cutouts, \(skipped) skipped")
