from PIL import Image, ImageDraw, ImageFont
import os

font_path = "/usr/share/fonts/truetype/noto/NotoKufiArabic-Black.ttf"
out_dir = "/nfs/102378605/outputs/pwa"
os.makedirs(out_dir, exist_ok=True)

sizes = [192, 512]
text = "سحنون"

for size in sizes:
    img = Image.new("RGB", (size, size), color="#0d6a3e")
    draw = ImageDraw.Draw(img)
    
    # Draw a subtle white border circle
    border = size // 20
    draw.ellipse([border, border, size-border, size-border], outline="white", width=size//40)
    
    # Text
    font_size = size // 4
    font = ImageFont.truetype(font_path, font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) / 2
    y = (size - th) / 2 - size // 20
    draw.text((x, y), text, fill="white", font=font)
    
    img.save(os.path.join(out_dir, f"icon-{size}.png"))
    print(f"Saved icon-{size}.png")
