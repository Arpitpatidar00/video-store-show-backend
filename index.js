const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Readable } = require('stream');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
const mongoURI = 'mongodb://localhost:27017';
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let gfs;
conn.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'videos',
  });
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
app.post('/upload', upload.single('video'), (req, res) => {
  const { title, description } = req.body;
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const readableVideoStream = Readable.from(req.file.buffer);

  const uploadStream = gfs.openUploadStream(req.file.originalname, {
    metadata: {
      title,
      description,
    },
  });

  readableVideoStream.pipe(uploadStream);

  uploadStream.on('finish', () => {
    res.status(201).send({
      message: 'File uploaded successfully',
      fileId: uploadStream.id,
    });
  });

  uploadStream.on('error', (err) => {
    console.error('Upload Error:', err);
    res.status(500).send('An error occurred during file upload.');
  });
});

// Get metadata for all videos
app.get('/videos', async (req, res) => {
  try {
    const files = await conn.db.collection('videos.files').find().toArray();
    res.json(files);
  } catch (err) {
    res.status(500).send('An error occurred while fetching videos.');
  }
});

// Stream video by ID
app.get('/videos/:id', (req, res) => {
  const fileId = new mongoose.Types.ObjectId(req.params.id);

  gfs.openDownloadStream(fileId)
    .on('error', (err) => {
      res.status(404).send('Video not found.');
    })
    .pipe(res);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
