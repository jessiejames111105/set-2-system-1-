import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const staticDir = join(rootDir, 'static');
const iconSvg = join(staticDir, 'icon.svg');

const sizes = [192, 512];
// Padding percentage (0.1 = 10% padding on each side, so icon takes 80% of canvas)
const paddingPercent = 0.12; 

async function generateIcons() {
	try {
		const svgBuffer = readFileSync(iconSvg);
		
		for (const size of sizes) {
			const outputPath = join(staticDir, `pwa-${size}x${size}.png`);
			
			// Calculate the icon size accounting for padding
			const iconSize = Math.floor(size * (1 - paddingPercent * 2));
			
			// Resize the SVG to fit within the padded area
			const resizedIcon = await sharp(svgBuffer)
				.resize(iconSize, iconSize, {
					fit: 'contain',
					background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
				})
				.png()
				.toBuffer();
			
			// Create a new image with the target size and composite the icon in the center
			await sharp({
				create: {
					width: size,
					height: size,
					channels: 4,
					background: { r: 255, g: 255, b: 255, alpha: 0 }
				}
			})
				.composite([{
					input: resizedIcon,
					top: Math.floor((size - iconSize) / 2),
					left: Math.floor((size - iconSize) / 2)
				}])
				.png()
				.toFile(outputPath);
			
			console.log(`✓ Generated ${outputPath} (with ${(paddingPercent * 100).toFixed(0)}% padding)`);
		}
		
		console.log('\n✅ PWA icons generated successfully!');
	} catch (error) {
		console.error('❌ Error generating icons:', error);
		process.exit(1);
	}
}

generateIcons();

