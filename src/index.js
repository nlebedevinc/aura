const express = require('express');
const fs = require('fs');

const app = express();

app.listen(3000, () => {
    console.log('Server started');
});

app.get('/api/play/:key', (req, res) => {
    const { key } = req.params;
    const path = 'files/' + key + '.mp3';

    const stat = fs.statSync(path);
    const range = req.headers.range;

    let readStream;

    if (range !== undefined && !(/firefox/i.test(req.headers['user-agent']))) {
        const parts = range.replace(/bytes=/, '').split('-');

        const partial_start = parts[0];
        const partial_end = parts[1];

        const start = parseInt(partial_start, 10);
        const end = partial_end ? parseInt(partial_end, 10) : stat.size - 1;
        const contentLength = (end - start) + 1;

        res.status(206).header({
            'Content-Type': 'audio/mpeg',
            'Content-Length': contentLength,
            'Content-Range': "bytes" + start + '-' + end + '/' + stat.size,
        });

        readStream = fs.createReadStream(path, {start, end});
    } else {
        res.header({
            'Content-Type': 'audio/mpeg',
            'Content-Length': stat.size,
        });
        readStream = fs.createReadStream(path);
    }

    readStream.pipe(res);
});