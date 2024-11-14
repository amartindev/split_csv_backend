import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import csvParser from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configura CORS para permitir solicitudes desde tu frontend en Netlify
// app.use(cors({
//     origin: 'https://split-csv.netlify.app', // Asegúrate de que la URL de tu frontend esté configurada correctamente
// }));

app.use(cors({
    origin: '*', // Permite solicitudes desde cualquier origen
  }));

const upload = multer({ dest: 'uploads/' }); // Utiliza la carpeta 'uploads' en la raíz

// Función para eliminar archivos generados anteriormente en 'uploads'
const deleteOldFiles = () => {
    const files = fs.readdirSync(path.join(__dirname, 'uploads'));
    files.forEach(file => {
        if (file.startsWith('output_part_') || file.startsWith('uploads/')) {
            const filePath = path.join(__dirname, 'uploads', file);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    });
};

// Ruta para recibir el archivo CSV y procesarlo
app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Archivo recibido:', req.file);
    console.log('Rows per file:', req.body.rowsPerFile);

    try {
        deleteOldFiles(); // Elimina los archivos previos al recibir un nuevo archivo

        if (!req.file) {
            return res.status(400).send({ error: 'No file uploaded' });
        }

        const filePath = path.join(__dirname, req.file.path); // Ruta en 'uploads'
        const results = [];
        const rowsPerFile = parseInt(req.body.rowsPerFile, 10) - 1;

        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => {
                results.push(row);
            })
            .on('end', () => {
                let fileIndex = 1;
                let downloadFiles = [];

                while (results.length > 0) {
                    const currentChunk = results.splice(0, rowsPerFile);
                    const downloadFileName = `output_part_${fileIndex}.csv`;
                    const outputFilePath = path.join(__dirname, 'uploads', downloadFileName);

                    const csvHeaders = Object.keys(currentChunk[0]).join(',') + '\n';
                    const csvData = currentChunk.map(row => Object.values(row).join(',')).join('\n');

                    fs.writeFileSync(outputFilePath, csvHeaders + csvData);
                    downloadFiles.push(downloadFileName);

                    fileIndex++;
                }

                fs.unlinkSync(filePath); // Borra el archivo original

                res.send({
                    message: 'Archivo procesado y dividido correctamente',
                    filenames: downloadFiles
                });
            })
            .on('error', (err) => {
                console.error('Error parsing CSV file:', err);
                res.status(500).send({ error: 'Error parsing CSV file' });
            });
    } catch (error) {
        console.error('Error during file processing:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Ruta para descargar cada archivo generado
app.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'uploads', filename);

        if (fs.existsSync(filePath)) {
            res.download(filePath, (err) => {
                if (err) {
                    console.error('Error during file download:', err);
                    res.status(404).send('File not found');
                } else {
                    fs.unlinkSync(filePath); // Elimina el archivo después de ser descargado
                }
            });
        } else {
            res.status(404).send('File not found');
        }
    } catch (error) {
        console.error('Error during file download:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// Inicia el servidor, usando el puerto de Vercel o el 3000 para desarrollo
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor iniciado en el puerto ${port}`);
});

export default app;
