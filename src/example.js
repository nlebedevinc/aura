const express = require('express');
const fs = require('fs');
const { PassThrough } = require('stream');

const app = express();

app.listen(3000, () => {
    console.log('Server started');
});

app.get('/api/play/:key', (req, res) => {
    const { key } = req.params;
    const path = 'samples/' + key + '.mp3';

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
            'Accept-Ranges': 'bytes',
            'Content-Range': "bytes " + start + '-' + end + '/' + stat.size,
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

// i need combined response
function mergeStream() {
    let sources = [];
    const output = new PassThrough({objectMode: true})
    // everything is on caller side
    output.setMaxListeners(0);
    output.add = add;

    output.on('unpipe', remove);

    Array.prototype.slice.call(arguments).forEach(add);
    
    return output;

    function add(source) {
        if (Array.isArray(source)) {
            source.forEach(add);
        } else {
            sources.push(source);
            source.once('end', remove.bind(null, source));
            source.once('error', output.emit.bind(output, 'error'));
            source.pipe(output, { end: false });
        }
        return this;
    }

    function remove(source) {
        sources = sources.filter(function (it) { return it !== source })
        if (!sources.length && output.readable) { output.end() }
    }
}

app.get('/api/play-all', (req, res) => {
    const path1 = 'samples/' + 'sample1' + '.mp3';
    const path2 = 'samples/' + 'sample2' + '.mp3';
    const stat1 = fs.statSync(path1);
    const stat2 = fs.statSync(path2);
    const range = req.headers.range;

    function defineSize(stats) {
        let size = 0;
        for (let i = 0; i < stats.length; ++i) {
            if (size < stats[i].size) {
                size = stats[i].size;
            }
        }

        return size;
    }

    let stream;

    if (range !== undefined && !(/firefox/i.test(req.headers['user-agent']))) {
        const parts = range.replace(/bytes=/, '').split('-');

        const partial_start = parts[0];
        const partial_end = parts[1];

        const start = parseInt(partial_start, 10);
        const end = partial_end ? parseInt(partial_end, 10) : (stat1.size + stat2.size) - 1;
        const contentLength = (end - start) + 1;

        res.status(206).header({
            'Content-Type': 'audio/mpeg',
            'Content-Length': contentLength,
            'Accept-Ranges': 'bytes',
            'Content-Range': "bytes " + start + '-' + end + '/' + (stat1.size + stat2.size),
        });

        stream = mergeStream(fs.createReadStream(path1), fs.createReadStream(path2));
    } else {
        res.header({
            'Content-Type': 'audio/mpeg',
            'Content-Length': stat1.size + stat2.size,
        });
        stream = mergeStream(fs.createReadStream(path1), fs.createReadStream(path2));
    }

    stream.pipe(res);
});
