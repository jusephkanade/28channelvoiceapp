import sharp from 'sharp';

const inputPath = 'C:\\Users\\itoka\\.gemini\\antigravity-ide\\brain\\2ddd5e5d-7194-41f7-987c-eaf4dffb563c\\glass_flower_icon_1_1781319475713.png';
const outputPath = 'c:\\Users\\itoka\\OneDrive\\Documentos\\28E Voice App\\assets\\icon.png';

async function crop() {
  try {
    await sharp(inputPath)
      .extract({ left: 190, top: 190, width: 644, height: 644 })
      .resize(1024, 1024)
      .toFile(outputPath);
    console.log('Icon cropped successfully!');
  } catch(e) {
    console.error(e);
  }
}
crop();
