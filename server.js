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
app.use(cors()); // Habilita CORS para permitir solicitudes desde el frontend

const upload = multer({ dest: 'uploads/' });

// Función para eliminar archivos generados anteriormente
const deleteOldFiles = () => {
    const files = fs.readdirSync(__dirname);
    files.forEach(file => {
        if (file.startsWith('output_part_') || file.startsWith('uploads/')) {
            fs.unlinkSync(path.join(__dirname, file));
        }
    });
};

// Ruta para recibir el archivo CSV y procesarlo
app.post('/upload', upload.single('file'), (req, res) => {
    deleteOldFiles(); // Elimina los archivos previos al recibir un nuevo archivo

    const filePath = path.join(__dirname, req.file.path);
    const results = [];
    const rowsPerFile = parseInt(req.body.rowsPerFile, 10) - 1; // Resta 1 al número de filas por archivo

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
                const outputFilePath = path.join(__dirname, downloadFileName);

                const csvHeaders = Object.keys(currentChunk[0]).join(',') + '\n';
                const csvData = currentChunk.map(row => Object.values(row).join(',')).join('\n');

                fs.writeFileSync(outputFilePath, csvHeaders + csvData);
                downloadFiles.push(downloadFileName);

                fileIndex++;
            }

            // Elimina el archivo original después de procesarlo
            fs.unlinkSync(filePath);

            res.send({
                message: 'Archivo procesado y dividido correctamente',
                filenames: downloadFiles
            });
        });
});

// Ruta para descargar cada archivo generado
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, filename);

    res.download(filePath, (err) => {
        if (err) {
            console.error(err);
            res.status(404).send('File not found');
        } else {
            // Elimina el archivo después de ser descargado
            fs.unlinkSync(filePath);
        }
    });
});

// Inicia el servidor en el puerto 3001
app.listen(3001, () => {
    console.log('Servidor iniciado en http://localhost:3001');
});
