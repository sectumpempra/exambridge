#import <AppKit/AppKit.h>
#import <CoreText/CoreText.h>

static NSString *const kDark = @"#253C4B";
static NSString *const kWarm = @"#AB9E92";
static NSString *const kCream = @"#F7F4F1";

static CGColorRef Color(NSString *hex) {
  unsigned value = 0;
  [[NSScanner scannerWithString:[hex substringFromIndex:1]] scanHexInt:&value];
  CGFloat components[] = {
    ((value >> 16) & 0xff) / 255.0,
    ((value >> 8) & 0xff) / 255.0,
    (value & 0xff) / 255.0,
    1.0,
  };
  CGColorSpaceRef space = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  CGColorRef color = CGColorCreate(space, components);
  CGColorSpaceRelease(space);
  return color;
}

static CGPathRef LeftPagePath(void) {
  CGMutablePathRef path = CGPathCreateMutable();
  CGPathMoveToPoint(path, NULL, 0, 1);
  CGPathAddCurveToPoint(path, NULL, 34, -1, 68, 10, 99, 32);
  CGPathAddLineToPoint(path, NULL, 99, 79);
  CGPathAddCurveToPoint(path, NULL, 64, 81, 31, 92, 0, 114);
  CGPathCloseSubpath(path);
  return path;
}

static CGPathRef RightPagePath(void) {
  CGMutablePathRef path = CGPathCreateMutable();
  CGPathMoveToPoint(path, NULL, 116, 32);
  CGPathAddCurveToPoint(path, NULL, 147, 10, 181, -1, 215, 1);
  CGPathAddLineToPoint(path, NULL, 215, 114);
  CGPathAddCurveToPoint(path, NULL, 184, 92, 151, 81, 116, 79);
  CGPathCloseSubpath(path);
  return path;
}

static CGPathRef BridgePath(void) {
  CGMutablePathRef path = CGPathCreateMutable();
  CGPathMoveToPoint(path, NULL, 0, 134);
  CGPathAddCurveToPoint(path, NULL, 33, 112, 69, 100, 101, 97);
  CGPathAddCurveToPoint(path, NULL, 106, 96, 111, 96, 116, 97);
  CGPathAddCurveToPoint(path, NULL, 149, 100, 183, 113, 215, 134);
  CGPathAddLineToPoint(path, NULL, 215, 179);
  CGPathAddCurveToPoint(path, NULL, 196, 170, 177, 164, 158, 160);
  CGPathAddCurveToPoint(path, NULL, 154, 136, 134, 117, 108, 117);
  CGPathAddCurveToPoint(path, NULL, 82, 117, 62, 136, 58, 160);
  CGPathAddCurveToPoint(path, NULL, 39, 164, 19, 170, 0, 179);
  CGPathCloseSubpath(path);
  return path;
}

static NSString *Number(CGFloat value) {
  NSString *text = [NSString stringWithFormat:@"%.2f", value];
  while ([text hasSuffix:@"0"]) text = [text substringToIndex:text.length - 1];
  if ([text hasSuffix:@"."]) text = [text substringToIndex:text.length - 1];
  return text;
}

static NSString *SVGPathFromCGPath(CGPathRef path, CGFloat offsetX, CGFloat baselineY) {
  NSMutableString *result = [NSMutableString string];
  CGPathApplyWithBlock(path, ^(const CGPathElement *element) {
    NSMutableString *output = result;
    CGPoint *p = element->points;
    NSString *(^point)(CGPoint) = ^NSString *(CGPoint value) {
      return [NSString stringWithFormat:@"%@ %@", Number(value.x + offsetX), Number(baselineY - value.y)];
    };
    switch (element->type) {
      case kCGPathElementMoveToPoint:
        [output appendFormat:@"M%@", point(p[0])];
        break;
      case kCGPathElementAddLineToPoint:
        [output appendFormat:@"L%@", point(p[0])];
        break;
      case kCGPathElementAddQuadCurveToPoint:
        [output appendFormat:@"Q%@ %@", point(p[0]), point(p[1])];
        break;
      case kCGPathElementAddCurveToPoint:
        [output appendFormat:@"C%@ %@ %@", point(p[0]), point(p[1]), point(p[2])];
        break;
      case kCGPathElementCloseSubpath:
        [output appendString:@"Z"];
        break;
    }
  });
  return result;
}

static NSString *WordmarkPath(void) {
  NSFont *font = [NSFont fontWithName:@"Avenir Next Medium" size:163.0];
  if (!font) {
    fprintf(stderr, "Avenir Next Medium is required to generate the outlined wordmark.\n");
    exit(2);
  }

  NSAttributedString *attributed = [[NSAttributedString alloc]
    initWithString:@"ExamBridge"
    attributes:@{NSFontAttributeName: font}];
  CTLineRef line = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)attributed);
  CGMutablePathRef combined = CGPathCreateMutable();
  CFArrayRef runs = CTLineGetGlyphRuns(line);
  for (CFIndex runIndex = 0; runIndex < CFArrayGetCount(runs); runIndex++) {
    CTRunRef run = (CTRunRef)CFArrayGetValueAtIndex(runs, runIndex);
    NSDictionary *attributes = (__bridge NSDictionary *)CTRunGetAttributes(run);
    CTFontRef runFont = (__bridge CTFontRef)attributes[(id)kCTFontAttributeName];
    CFIndex count = CTRunGetGlyphCount(run);
    CGGlyph *glyphs = calloc((size_t)count, sizeof(CGGlyph));
    CGPoint *positions = calloc((size_t)count, sizeof(CGPoint));
    CTRunGetGlyphs(run, CFRangeMake(0, count), glyphs);
    CTRunGetPositions(run, CFRangeMake(0, count), positions);
    for (CFIndex index = 0; index < count; index++) {
      CGPathRef glyphPath = CTFontCreatePathForGlyph(runFont, glyphs[index], NULL);
      if (!glyphPath) continue;
      CGAffineTransform transform = CGAffineTransformMakeTranslation(positions[index].x, positions[index].y);
      CGPathAddPath(combined, &transform, glyphPath);
      CGPathRelease(glyphPath);
    }
    free(glyphs);
    free(positions);
  }
  NSString *result = SVGPathFromCGPath(combined, 271, 153);
  CGPathRelease(combined);
  CFRelease(line);
  return result;
}

static NSString *MarkPaths(NSString *dark, NSString *warm) {
  return [NSString stringWithFormat:
    @"  <path d=\"M0 1C34 -1 68 10 99 32L99 79C64 81 31 92 0 114Z\" fill=\"%@\"/>\n"
     "  <path d=\"M116 32C147 10 181 -1 215 1L215 114C184 92 151 81 116 79Z\" fill=\"%@\"/>\n"
     "  <path d=\"M0 134C33 112 69 100 101 97C106 96 111 96 116 97C149 100 183 113 215 134L215 179C196 170 177 164 158 160C154 136 134 117 108 117C82 117 62 136 58 160C39 164 19 170 0 179Z\" fill=\"%@\"/>\n",
    dark, warm, dark];
}

static void WriteText(NSString *path, NSString *text) {
  NSError *error = nil;
  if (![text writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:&error]) {
    fprintf(stderr, "Could not write %s: %s\n", path.UTF8String, error.localizedDescription.UTF8String);
    exit(3);
  }
}

static void FillPath(CGContextRef context, CGPathRef path, CGColorRef color) {
  CGContextAddPath(context, path);
  CGContextSetFillColorWithColor(context, color);
  CGContextFillPath(context);
}

static void DrawMark(CGContextRef context, CGRect rect, BOOL monochrome) {
  CGFloat scale = MIN(rect.size.width / 216.0, rect.size.height / 180.0);
  CGFloat width = 216.0 * scale;
  CGFloat height = 180.0 * scale;
  CGFloat x = rect.origin.x + (rect.size.width - width) / 2.0;
  CGFloat y = rect.origin.y + (rect.size.height - height) / 2.0;
  CGContextSaveGState(context);
  CGContextTranslateCTM(context, x, y);
  CGContextScaleCTM(context, scale, scale);

  CGColorRef dark = Color(kDark);
  CGColorRef warm = monochrome ? CGColorRetain(dark) : Color(kWarm);
  CGPathRef left = LeftPagePath();
  CGPathRef right = RightPagePath();
  CGPathRef bridge = BridgePath();
  FillPath(context, left, dark);
  FillPath(context, right, warm);
  FillPath(context, bridge, dark);
  CGPathRelease(left);
  CGPathRelease(right);
  CGPathRelease(bridge);
  CGColorRelease(dark);
  CGColorRelease(warm);
  CGContextRestoreGState(context);
}

static void WritePNG(NSString *path, NSInteger size, CGFloat markFraction) {
  NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc]
    initWithBitmapDataPlanes:NULL
    pixelsWide:size
    pixelsHigh:size
    bitsPerSample:8
    samplesPerPixel:4
    hasAlpha:YES
    isPlanar:NO
    colorSpaceName:NSCalibratedRGBColorSpace
    bytesPerRow:0
    bitsPerPixel:0];
  NSGraphicsContext *graphics = [NSGraphicsContext graphicsContextWithBitmapImageRep:bitmap];
  [NSGraphicsContext saveGraphicsState];
  [NSGraphicsContext setCurrentContext:graphics];
  CGContextRef context = graphics.CGContext;
  CGContextTranslateCTM(context, 0, size);
  CGContextScaleCTM(context, 1, -1);

  CGColorRef cream = Color(kCream);
  CGContextSetFillColorWithColor(context, cream);
  CGContextFillRect(context, CGRectMake(0, 0, size, size));
  CGColorRelease(cream);

  CGFloat markWidth = size * markFraction;
  CGFloat markHeight = markWidth * 180.0 / 216.0;
  CGRect markRect = CGRectMake((size - markWidth) / 2.0, (size - markHeight) / 2.0, markWidth, markHeight);
  DrawMark(context, markRect, NO);

  [NSGraphicsContext restoreGraphicsState];
  NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
  if (![png writeToFile:path atomically:YES]) {
    fprintf(stderr, "Could not write PNG %s\n", path.UTF8String);
    exit(4);
  }
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 2) {
      fprintf(stderr, "Usage: generate-brand-v2 OUTPUT_DIR\n");
      return 1;
    }
    NSString *output = [NSString stringWithUTF8String:argv[1]];
    [[NSFileManager defaultManager] createDirectoryAtPath:output withIntermediateDirectories:YES attributes:nil error:nil];
    NSString *wordmark = WordmarkPath();

    NSString *mark = [NSString stringWithFormat:
      @"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 216 180\" role=\"img\" aria-labelledby=\"title desc\">\n"
       "  <title id=\"title\">ExamBridge symbol</title>\n"
       "  <desc id=\"desc\">An open book forming a bridge.</desc>\n%@</svg>\n",
      MarkPaths(kDark, kWarm)];
    WriteText([output stringByAppendingPathComponent:@"exambridge-mark.svg"], mark);

    NSString *horizontal = [NSString stringWithFormat:
      @"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1190 190\" role=\"img\" aria-labelledby=\"title desc\">\n"
       "  <title id=\"title\">ExamBridge</title>\n"
       "  <desc id=\"desc\">ExamBridge wordmark with an open-book bridge symbol.</desc>\n"
       "  <g transform=\"translate(0 5)\">\n%@  </g>\n"
       "  <path d=\"%@\" fill=\"%@\"/>\n"
       "</svg>\n",
      MarkPaths(kDark, kWarm), wordmark, kDark];
    WriteText([output stringByAppendingPathComponent:@"exambridge-logo-horizontal.svg"], horizontal);

    NSString *mono = [NSString stringWithFormat:
      @"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1190 190\" role=\"img\" aria-labelledby=\"title desc\" color=\"#253C4B\">\n"
       "  <title id=\"title\">ExamBridge monochrome logo</title>\n"
       "  <desc id=\"desc\">Single-colour ExamBridge wordmark and symbol.</desc>\n"
       "  <g transform=\"translate(0 5)\">\n%@  </g>\n"
       "  <path d=\"%@\" fill=\"currentColor\"/>\n"
       "</svg>\n",
      MarkPaths(@"currentColor", @"currentColor"), wordmark];
    WriteText([output stringByAppendingPathComponent:@"exambridge-logo-monochrome.svg"], mono);

    NSString *monoMark = [NSString stringWithFormat:
      @"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 216 180\" role=\"img\" aria-labelledby=\"title\" color=\"#253C4B\">\n"
       "  <title id=\"title\">ExamBridge monochrome symbol</title>\n%@</svg>\n",
      MarkPaths(@"currentColor", @"currentColor")];
    WriteText([output stringByAppendingPathComponent:@"exambridge-mark-monochrome.svg"], monoMark);

    NSString *favicon = [NSString stringWithFormat:
      @"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" role=\"img\" aria-label=\"ExamBridge\">\n"
       "  <rect width=\"128\" height=\"128\" rx=\"26\" fill=\"%@\"/>\n"
       "  <g transform=\"translate(18 25.67) scale(.42791)\">\n%@  </g>\n"
       "</svg>\n",
      kCream, MarkPaths(kDark, kWarm)];
    WriteText([output stringByAppendingPathComponent:@"favicon.svg"], favicon);

    NSString *pwa = [NSString stringWithFormat:
      @"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" role=\"img\" aria-label=\"ExamBridge\">\n"
       "  <rect width=\"512\" height=\"512\" fill=\"%@\"/>\n"
       "  <g transform=\"translate(80 109.33) scale(1.62963)\">\n%@  </g>\n"
       "</svg>\n",
      kCream, MarkPaths(kDark, kWarm)];
    WriteText([output stringByAppendingPathComponent:@"pwa-icon.svg"], pwa);

    NSString *maskable = [NSString stringWithFormat:
      @"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" role=\"img\" aria-label=\"ExamBridge\">\n"
       "  <rect width=\"512\" height=\"512\" fill=\"%@\"/>\n"
       "  <g transform=\"translate(106 131) scale(1.38889)\">\n%@  </g>\n"
       "</svg>\n",
      kCream, MarkPaths(kDark, kWarm)];
    WriteText([output stringByAppendingPathComponent:@"pwa-icon-maskable.svg"], maskable);

    NSString *preview = [NSString stringWithFormat:
      @"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1600 900\" role=\"img\" aria-labelledby=\"title desc\">\n"
       "  <title id=\"title\">ExamBridge brand version two preview</title>\n"
       "  <desc id=\"desc\">Horizontal, symbol, monochrome, favicon and PWA variants.</desc>\n"
       "  <rect width=\"1600\" height=\"900\" fill=\"%@\"/>\n"
       "  <g transform=\"translate(150 135) scale(1.1)\">\n"
       "    <g transform=\"translate(0 5)\">\n%@    </g>\n"
       "    <path d=\"%@\" fill=\"%@\"/>\n"
       "  </g>\n"
       "  <path d=\"M120 405H1480\" stroke=\"#D8D1CA\"/>\n"
       "  <text x=\"150\" y=\"470\" font-family=\"Avenir Next, sans-serif\" font-size=\"24\" fill=\"#6B645E\">COLOUR MARK</text>\n"
       "  <g transform=\"translate(150 520)\">\n%@  </g>\n"
       "  <text x=\"515\" y=\"470\" font-family=\"Avenir Next, sans-serif\" font-size=\"24\" fill=\"#6B645E\">MONOCHROME</text>\n"
       "  <g transform=\"translate(515 520)\">\n%@  </g>\n"
       "  <text x=\"880\" y=\"470\" font-family=\"Avenir Next, sans-serif\" font-size=\"24\" fill=\"#6B645E\">APP ICONS</text>\n"
       "  <rect x=\"880\" y=\"520\" width=\"180\" height=\"180\" rx=\"38\" fill=\"#FFFFFF\"/>\n"
       "  <g transform=\"translate(900 552.5) scale(.65116)\">\n%@  </g>\n"
       "  <rect x=\"1110\" y=\"520\" width=\"180\" height=\"180\" fill=\"%@\"/>\n"
       "  <g transform=\"translate(1145 575.83) scale(.50926)\">\n%@  </g>\n"
       "  <text x=\"150\" y=\"825\" font-family=\"Avenir Next, sans-serif\" font-size=\"20\" fill=\"#776F68\">Flat vector master · #253C4B · #AB9E92 · #F7F4F1</text>\n"
       "</svg>\n",
      kCream,
      MarkPaths(kDark, kWarm), wordmark, kDark,
      MarkPaths(kDark, kWarm),
      MarkPaths(@"#253C4B", @"#253C4B"),
      MarkPaths(kDark, kWarm),
      kCream, MarkPaths(kDark, kWarm)];
    WriteText([output stringByAppendingPathComponent:@"brand-v2-preview.svg"], preview);

    WritePNG([output stringByAppendingPathComponent:@"favicon-16x16.png"], 16, 0.82);
    WritePNG([output stringByAppendingPathComponent:@"favicon-32x32.png"], 32, 0.82);
    WritePNG([output stringByAppendingPathComponent:@"apple-touch-icon-180x180.png"], 180, 0.69);
    WritePNG([output stringByAppendingPathComponent:@"icon-192x192.png"], 192, 0.69);
    WritePNG([output stringByAppendingPathComponent:@"icon-512x512.png"], 512, 0.69);
    WritePNG([output stringByAppendingPathComponent:@"maskable-icon-512x512.png"], 512, 0.586);

    printf("Generated ExamBridge brand v2 assets in %s\n", output.UTF8String);
  }
  return 0;
}
