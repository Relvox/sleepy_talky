# Third-Party Licenses

This document contains license information for third-party libraries used in Sleepy Talky.

---

## FFmpeg

This software uses libraries from the FFmpeg project.

- **Project Website**: http://ffmpeg.org
- **License**: GNU Lesser General Public License (LGPL) version 2.1 or later
- **Usage**: Audio processing and format conversion via FFmpeg.wasm

### Source Code Availability

The complete source code for FFmpeg and related components is available at:

- **FFmpeg.wasm wrapper**: https://github.com/ffmpegwasm/ffmpeg.wasm (MIT License)
- **FFmpeg.wasm core**: https://github.com/ffmpegwasm/ffmpeg.wasm-core (LGPL v2.1+)
- **Original FFmpeg**: https://github.com/FFmpeg/FFmpeg (LGPL v2.1+)

### License Summary

Most files in FFmpeg are under the GNU Lesser General Public License version 2.1 or later (LGPL v2.1+). This project uses FFmpeg dynamically via WebAssembly modules, which complies with LGPL requirements.

### Full License Text

The complete LGPL v2.1 license can be found at:
https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html

#### Key LGPL v2.1 Terms (Summary - Not Legal Advice):

- **Freedom to Use**: You can use this software for any purpose, including commercial applications
- **Dynamic Linking**: Allowed without requiring your code to be LGPL (as we do with WASM modules)
- **Source Code**: Users must be able to access the complete source code of the LGPL library
- **Modifications**: If you modify the LGPL library itself, you must release those modifications under LGPL
- **No Warranty**: The library is provided "as-is" without warranty

**Important**: This is a simplified summary. For complete legal terms, refer to the full license text linked above.

---

## Flaticon Icons

Speech balloon icons used in this project are created by Freepik.

- **Source**: https://www.flaticon.com/free-icons/speech-balloon
- **Author**: Freepik
- **License**: Flaticon Free License
- **Usage**: Application logo and favicon

### Flaticon License Terms

Icons are free to use with attribution. The attribution is provided in this document and in the project README.

---

## FFmpeg.wasm

The JavaScript wrapper for FFmpeg (not the core libraries) is separately licensed:

- **Project**: https://github.com/ffmpegwasm/ffmpeg.wasm
- **License**: MIT License
- **Copyright**: Copyright (c) 2019 Jerome Wu

### MIT License (FFmpeg.wasm wrapper only)

```
MIT License

Copyright (c) 2019 Jerome Wu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Compliance Notes

### How We Comply with LGPL

1. **Dynamic Linking**: We use FFmpeg via WebAssembly modules, which constitutes dynamic linking
2. **No Modifications**: We use unmodified FFmpeg.wasm builds
3. **Source Access**: We provide links to all source code repositories
4. **Attribution**: We credit FFmpeg in our README, website footer, and this document
5. **License Availability**: Full license texts are linked and available

### For Developers

If you modify or redistribute this project:

1. **Keep Attributions**: Maintain all license notices and attributions
2. **Link Sources**: Keep links to FFmpeg source code accessible
3. **Document Changes**: If you modify FFmpeg itself (not just FFmpeg.wasm), document those changes
4. **Respect LGPL**: Ensure any distribution complies with LGPL v2.1 requirements

---

**Last Updated**: 2025-10-09

For questions about licensing, please refer to:
- FFmpeg Legal: https://www.ffmpeg.org/legal.html
- LGPL FAQ: https://www.gnu.org/licenses/gpl-faq.html
