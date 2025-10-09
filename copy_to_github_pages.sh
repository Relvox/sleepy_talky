#!/bin/bash

# Bash script to copy web assets to GitHub Pages directory

SOURCE_DIR="."
TARGET_DIR="../relvox.github.io/sleepy_talky"

echo "Copying web assets to GitHub Pages..."

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Copy all HTML files
echo "Copying HTML files..."
find "$SOURCE_DIR" -maxdepth 1 -name "*.html" -exec cp {} "$TARGET_DIR/" \;

# Copy all CSS files
echo "Copying CSS files..."
find "$SOURCE_DIR" -maxdepth 1 -name "*.css" -exec cp {} "$TARGET_DIR/" \;

# Copy all PNG files
echo "Copying PNG files..."
find "$SOURCE_DIR" -maxdepth 1 -name "*.png" -exec cp {} "$TARGET_DIR/" \;

# Copy all ICO files
echo "Copying ICO files..."
find "$SOURCE_DIR" -maxdepth 1 -name "*.ico" -exec cp {} "$TARGET_DIR/" \;

# Copy entire js directory structure
echo "Copying JavaScript files..."
if [ -d "$SOURCE_DIR/js" ]; then
    cp -r "$SOURCE_DIR/js" "$TARGET_DIR/"
fi

# Copy libs directory (FFmpeg files)
echo "Copying library files..."
if [ -d "$SOURCE_DIR/libs" ]; then
    cp -r "$SOURCE_DIR/libs" "$TARGET_DIR/"
fi

echo ""
echo "Copy complete!"
echo "Files copied to: $TARGET_DIR"
