#!/usr/bin/env python3
"""
Generate PWA icons from speech-bubble.png
Requires: pip install Pillow
"""

from PIL import Image
import os

# Icon sizes required for PWA
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]


def generate_icons():
    """Generate all required icon sizes from source image"""
    source = "speech-bubble.png"

    if not os.path.exists(source):
        print(f"Error: {source} not found")
        return

    # Create icons directory
    os.makedirs("icons", exist_ok=True)

    try:
        img = Image.open(source)
        print(f"Source image: {img.size[0]}x{img.size[1]}")

        for size in SIZES:
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            output_path = f"icons/icon-{size}.png"
            resized.save(output_path, "PNG")
            print(f"Generated: {output_path}")

        print("\nAll icons generated successfully!")
        print("Update manifest.json to reference these icons.")

    except Exception as e:
        print(f"Error generating icons: {e}")


if __name__ == "__main__":
    generate_icons()
