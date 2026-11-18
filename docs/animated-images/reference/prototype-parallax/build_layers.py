"""Prototype: split a photo into foreground cut-out + filled background plate.
Usage: python build_layers.py photo.png
Outputs: fg_alpha.png (soft mask), bg_plate.png (background with subject filled in)
Production should replace the cv2.inpaint fill with LaMa (see HANDOVER.md)."""
import sys, cv2, numpy as np
from rembg import remove, new_session
from PIL import Image

p = cv2.imread(sys.argv[1]); H, W = p.shape[:2]
session = new_session('isnet-general-use')
m = np.array(remove(Image.open(sys.argv[1]), session=session, only_mask=True)).astype(np.float32) / 255
m = cv2.GaussianBlur(m, (5, 5), 0)
cv2.imwrite('fg_alpha.png', (m * 255).astype(np.uint8))

# background plate: dilate the hole so no subject edge remains, fill at half res, soften
hole = cv2.dilate((m > 0.1).astype(np.uint8) * 255, np.ones((25, 25), np.uint8))
small = cv2.inpaint(cv2.resize(p, (W // 2, H // 2)), cv2.resize(hole, (W // 2, H // 2)), 15, cv2.INPAINT_TELEA)
fill = cv2.GaussianBlur(cv2.resize(small, (W, H)), (31, 31), 0)
bg = np.where(hole[..., None] > 0, fill, p)
cv2.imwrite('bg_plate.png', bg)
