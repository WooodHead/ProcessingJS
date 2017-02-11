document.addEventListener("DOMContentLoaded", function(event) {

    var canvas = document.getElementById("canvas");
    var processing = new Processing(canvas, function(processing) {
        processing.size(400, 600);
        processing.background(0xFFF);

        var mouseIsPressed = false;
        processing.mousePressed = function() { mouseIsPressed = true; };
        processing.mouseReleased = function() { mouseIsPressed = false; };

        var keyIsPressed = false;
        processing.keyPressed = function() { keyIsPressed = true; };
        processing.keyReleased = function() { keyIsPressed = false; };

        function getImage(s) {
            var url = "https://www.kasandbox.org/programming-images/" + s + ".png";
            processing.externals.sketch.imageCache.add(url);
            return processing.loadImage(url);
        }

        // use degrees rather than radians in rotate function
        var rotateFn = processing.rotate;
        processing.rotate = function(angle) {
            rotateFn(processing.radians(angle));
        };

        with(processing) {


                var unlockAllPuzzles = true;

                { // Miscellaneous
                    var cache = {}; // hoisted
                    var system = {};

                    var TILE_SIZE = 50;
                    var TRAY_TILE_SIZE = 20;

                    var puzzles = []; // all puzzles
                    var puzzle; // current puzzle
                    var draggedPiece; // piece being dragged
                    draggedPiece = false;
                } // Miscellaneous

                var maps = [ // 24 puzzle maps
                    [
                        ' 0 ',
                        '000',
                        ' 0 '
                    ], // 1
                    [
                        '000',
                        ' 1 ',
                        '11 ',
                        ' 1 '
                    ],
                    [
                        ' 012 ',
                        '00122',
                        ' 112 '
                    ],
                    [
                        '011',
                        '012',
                        '0 2',
                        '032',
                        '333'
                    ],
                    [
                        ' 00 ',
                        '1111',
                        '2233',
                        ' 23 ',
                        ' 23 '
                    ], // 5

                ]; // 24 puzzle maps



                var mouse = {
                    get x() {
                        return this.isLocked ? Infinity : mouseX;
                    },
                    get y() {
                        return this.isLocked ? Infinity : mouseY;
                    },

                    get 'point' () {
                        return new PVector(this.x, this.y);
                    },

                    isPressed: false, // indicates if mouse has been pressed
                    isClicked: false, // indicates if mouse has been clicked (pressed & released)
                    isLocked: false, // indicates if mouse inputs will be ignored

                    consumeClick: function(button) {
                        if (this.isClicked && (button || LEFT) === mouseButton) {
                            this.isClicked = false;
                            return true;
                        } else {
                            return false;
                        }
                    },

                    isInEllipse: function(x, y, width, height) {
                        if (arguments.length < 4) { height = width; }
                        return sq((this.x - x) / (width / 2)) + sq((this.y - y) / (height / 2)) <= 1;
                    },

                    isInRect: function(left, top, width, height) {
                        return this.x >= left && this.x < left + width && this.y >= top && this.y < top + height;
                    }
                };

                var system = (function() {
                    var _previousScene; // prior scene
                    var _scene = 'splash'; // current scene
                    var _sceneInfo; // information passed to current scene
                    var _newSceneData = false; // temporarily holds info about the pending scene change
                    var _frames = 0; // current frame # of current scene
                    var _time = millis(); // used so that the time doesn't vary while processing a frame

                    return {
                        get isDebugging() {
                            return true;
                        },

                        get scene() {
                            return _scene;
                        },

                        get sceneInfo() {
                            return _sceneInfo;
                        },

                        get previousScene() {
                            return _previousScene;
                        },

                        get frames() {
                            return _frames;
                        },

                        get time() {
                            return _time;
                        },



                        // Set-up a new scene.  The actual scene change occurs in `initializeFrame`.
                        changeScene: function(newScene, sceneInfo) {
                            /** Actual change deferred to avoid resetting `system.frames` while a scene is being drawn. **/
                            _newSceneData = { newScene: newScene, sceneInfo: sceneInfo };

                            // mouse.isLocked = true;
                        },

                        // Advance frame for current scene -OR- set-up new scene.
                        initializeFrame: function() {
                            // Had `changeScene` been called?
                            if (_newSceneData) {
                                // Execute the requested scene change.
                                _previousScene = _scene;
                                _scene = _newSceneData.newScene;
                                _sceneInfo = _newSceneData.sceneInfo;
                                _frames = 1;

                                _newSceneData = false;

                                // Update current scene.
                            } else {
                                _frames++;
                            }

                            // cursor('default');
                            // resetMatrix();
                            _time = millis();
                        },


                    };
                })();

                var computeOutlines = (function( /* grid, tiles, offset */ ) { // Puzzle & piece outlining
                    var offsets; // offsets to locations of points along each edge
                    var edges; // array of points along an outline's edge

                    var populateEdges = function(tile, side) {
                        for (var i = 0; i < 4; i++) { // do once for each edge...
                            var neighbor = tile.neighbors[side];
                            if (neighbor === 'edge') {
                                edges.push({ x: tile.left + offsets[side].x, y: tile.top + offsets[side].y, side: side });

                                tile.neighbors[side] = false; // mark edge as having been processed
                                side = ++side % 4; // advance to next side
                            } else { // Encountered either an adjacent tile or an edge that has already been processed.
                                // If there's an adjacent tile, "back-up" and check the previous side (if it hasn't been processed).
                                if (neighbor && neighbor.neighbors[side = (side + 3) % 4]) {
                                    populateEdges(neighbor, side);
                                }
                                return; // don't process this tile any further.
                            }
                        }
                    };

                    return function(grid, tiles, offset) {
                        offsets = [{ x: -offset, y: TILE_SIZE / 2 }, // LEFT
                            { x: TILE_SIZE / 2, y: -offset }, // UP
                            { x: TILE_SIZE + offset, y: TILE_SIZE / 2 }, // RIGHT
                            { x: TILE_SIZE / 2, y: TILE_SIZE + offset }
                        ]; // DOWN

                        // Populate neighbors.
                        var neighbor;
                        tiles.forEach(function(tile) {
                            // Check to the right.
                            if ((neighbor = grid[tile.row][tile.column + 1])) {
                                tile.neighbors[2] = neighbor;
                                neighbor.neighbors[0] = tile;
                            }

                            // Check below.
                            if (grid[tile.row + 1] && (neighbor = grid[tile.row + 1][tile.column])) {
                                tile.neighbors[3] = neighbor;
                                neighbor.neighbors[1] = tile;
                            }
                        });

                        // Compute outlines as arrays of edges.
                        var outlines = [];
                        tiles.forEach(function(tile) {
                            if (tile.neighbors[0] === 'edge') {
                                edges = [];
                                populateEdges(tile, 0);
                                outlines.push(edges);
                            }
                        });

                        // Convert outlines from arrays of edges to arrays of corners.
                        return outlines.map(function(edges) {
                            // Create corner points.
                            var corners = [],
                                a, b;
                            for (var i = 0; i < edges.length; i++) {
                                // Do the two adjacent edges span a corner?  I.e., they're not on the same side of their respective tiles.
                                if ((a = edges[i]).side !== (b = edges[(i + 1) % edges.length]).side) {
                                    if (a.side & 1) { // a.side === 1 or 3 (top or bottom)
                                        corners.push({ x: b.x, y: a.y });
                                    } else {
                                        corners.push({ x: a.x, y: b.y });
                                    }
                                }
                            }
                            return corners;
                        });
                    };
                })(); // Puzzle & piece outlining

                var Coaster = function(centerX, centerY) { // Placeholder for piece while in the tray
                    this.point = new PVector(centerX, centerY);
                    // this.piece = false;
                }; // Placeholder for piece while in the tray

                var PieceTile = function(column, row) {
                    this.left = (this.column = column) * TILE_SIZE;
                    this.top = (this.row = row) * TILE_SIZE;

                    this.neighbors = ['edge', 'edge', 'edge', 'edge'];
                };

                var Piece = function(grid, tiles, number) {
                    this.border = computeOutlines(grid, this.tiles = tiles, -2)[0];

                    console.log("this.border",this.border);
                    // this.edgeColor = lerpColor(this.faceColor = this._colors[number], color(0), 0.35);
                    // console.log(this.edgeColor );
                    this.width = (this.columns = grid[0].length) * TILE_SIZE;
                    this.height = (this.rows = grid.length) * TILE_SIZE;

                    this.point = new PVector(0, 0); // center's location
                    console.log("this.point",this.point);
                };

                Object.defineProperties(Piece.prototype, {
                    zOrder: {
                        // Determines order in which pieces are drawn (lower values on top).
                        get: function() {
                            return this === draggedPiece ? 1 : this.target ? 2 : 3;
                        }
                    }
                });

                Piece.prototype._colors = [
                    0xffe56ee5, // purple
                    0xffe56e38, // orange
                    0xff87e56e, // green
                    0xff6ee5e5, // cyan
                    0xffe5e56e, // yellow
                    0xff876ee5, // blue
                    0xffe56e87, // red
                    0xffafafaf, // light grey
                    0xff6e6e6e // grey
                ];

                Piece.prototype.reset = function(coaster) {
                    (this.coaster = coaster).piece = this;
                    this.point.set(coaster.point);
                    // this.isLockedToMouse = this.target = false;
                };

                Piece.prototype.update = function() {
                    if (this.isLockedToMouse) {
                        // console.log("msg");
                        this.point.set(mouse.x, mouse.y);
                    } else if (this.target) { // target may be a Coaster, PVector, or mouse
                        // console.log("msg");

                        var targetPoint = (this.target instanceof PVector ? this.target : this.target.point);
                        var diff = PVector.sub(targetPoint, this.point);
                        var distance = diff.mag();
                        if (distance <= 10) {
                            this.point.set(targetPoint);
                            this.isLockedToMouse = this.target === mouse;
                            if (this.target instanceof Coaster) {
                                this.target.piece = this;
                            }
                            this.target = false;
                        } else {
                            diff.normalize();
                            diff.mult(this.target === mouse ? max(10, distance / 4) : 10);
                            this.point.add(diff);
                        }
                    }
                };

                Piece.prototype.draw = function() {
                    // console.log("this.point.x",this.point.x);
                    // console.log("this.point.y",this.point.y);

                    pushMatrix();

                    // console.log("this.point.x",this.point.x);
                    // console.log("this.point.y",this.point.y);

                    translate(this.point.x, this.point.y);
                    // scale(constrain(map(this.point.y, this.coaster.point.y, 400, TRAY_TILE_SIZE, TILE_SIZE), TRAY_TILE_SIZE, TILE_SIZE) / TILE_SIZE); // 400 is the y-coor of the top of the tray
                    translate(-this.width / 2, -this.height / 2);
                    
                    // console.log("-this.width / 2",-this.width / 2);
                    // console.log("-this.height / 2",-this.height / 2);
                    // strokeWeight(4);
                    // stroke(this.edgeColor);
                    // fill(this.faceColor);
                    beginShape();
                    this.border.forEach(this._vertex);
                    endShape(CLOSE);

                    popMatrix();
                };

                Piece.prototype._vertex = function(corner) {
                    vertex(corner.x, corner.y);
                };

                var BoardTile = function(column, row, left, top) {
                    this.column = column;
                    this.row = row;
                    this.right = (this.left = left) + TILE_SIZE - 1;
                    this.bottom = (this.top = top) + TILE_SIZE - 1;

                    this.piece = false;

                    this.neighbors = ['edge', 'edge', 'edge', 'edge'];
                };

                BoardTile.prototype.isUnder = function(x, y) {
                    return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
                };

                var Board = function(map) {
                    this.left = 200 - (this.width = (this.columns = (this.map = map)[0].length) * TILE_SIZE) / 2;
                    this.top = 234 - (this.height = (this.rows = map.length) * TILE_SIZE) / 2;

                    // Compute the tiles & outlines.
                    this.tiles = [];
                    var grid = []; // grid of tiles used for finding the outlines
                    this.map.forEach(function(string, row) {
                        grid.push([]); // create grid row
                        (map[row] = string.split('')).forEach(function(tileData, column) {
                            grid[row].push(false); // create/initialize grid square
                            if (tileData !== ' ') {
                                this.tiles.push(grid[row][column] = new BoardTile(column, row, this.left + column * TILE_SIZE, this.top + row * TILE_SIZE));
                            }
                        }, this);
                    }, this);
                    this.outlines = computeOutlines(grid, this.tiles, 5);

                    // Compute the pieces.
                    this.pieces = [];
                    for (var i = 0; i <= 9; i++) {
                        var piece = this._createPiece(i);
                        if (piece) {
                            this.pieces.push(piece);
                        }
                    }
                };


                Board.prototype.draw = function() {
                    this.outlines.forEach(this._drawOutline, this);

                };

                Board.prototype._createPiece = function(pieceNumber) {
                    var pieceChar = pieceNumber.toString();

                    // Indexes of bounding rectangle encompassing the piece.
                    var left = Infinity,
                        top = Infinity,
                        right = -1,
                        bottom = -1;
                    var i;
                    this.map.forEach(function(rowData, row) {
                        i = rowData.indexOf(pieceChar);
                        if (i >= 0) {
                            left = min(left, i);
                            right = max(right, rowData.lastIndexOf(pieceChar));
                            top = min(top, row);
                            bottom = row;
                        }
                    });

                    // Was the piece found in the map?
                    if (right >= 0) {
                        var grid = [];
                        var tiles = [];
                        var row = 0;
                        for (var j = top; j <= bottom; j++) {
                            grid.push([]); // create grid row
                            var column = 0;
                            for (var i = left; i <= right; i++) {
                                grid[row].push(false); // create/initialize grid square
                                if (this.map[j][i] === pieceChar) {
                                    tiles.push(grid[row][column] = new PieceTile(column, row));
                                }
                                column++;
                            }
                            row++;
                        }

                        return new Piece(grid, tiles, pieceNumber);
                    }
                    // Piece not found in map; return undefined;
                };

                { // Callbacks used by Board.prototype.draw
                    Board.prototype._drawOutline = function(outline, isInsideHole) {
                        // The first outline is for the outer edge of the tiles,
                        //   but subsequent outlines are for "holes" in the game board.

                        // console.log(outline);
                        if (isInsideHole) {
                            // fill(229, 173, 110); // background color
                        } else {
                            // fill(141, 76, 29); // tile face color
                        }
                        for (var i = 1; i <= 10; i++) {
                            // strokeWeight(10 - i);
                            // stroke(lerpColor(color(55, 19, 0), color(225, 160, 64), i / 10));
                            beginShape();
                            outline.forEach(this._vertex);
                            endShape(CLOSE);

                            // noFill();
                        }
                    };

                    Board.prototype._vertex = function(corner) {
                        vertex(corner.x, corner.y);
                    };


                    Board.prototype._tileWithPlacedPieceUnderMouse = function(tile) {
                        // return tile.piece && mouse.isInRect(tile.left, tile.top, TILE_SIZE, TILE_SIZE);
                    };
                } // Callbacks used by Board.prototype.draw



                var Puzzle = function(index) {
                    this.tray = this._coasters[(this.pieces = (this.board = new Board(this.map = maps[this.index = index])).pieces).length];
                    // this.hasEverBeenSolved = this.isSolved = false;
                };

                Puzzle.prototype.reset = function() {
                    // draggedPiece = this.isSolved = false;

                    // Create list of indexes into this.pieces.
                    var indexes = [];
                    for (var i = 0; i < this.pieces.length; i++) {
                        indexes.push(i);
                    }
                    // For each coaster on the tray, randomly select a piece to place on the coaster.
                    this.tray.forEach(function(coaster) {
                        var i = floor(random(indexes.length));
                        this.pieces[indexes[i]].reset(coaster);

                    }, this);
                };

                Puzzle.prototype.releaseDraggedPiece = function() {
                    // Locate center of piece's upper/left corner tile.
                    // Use mouse's location instead of draggedPiece in case the piece hasn't yet caught up to the mouse.
                    var x = mouse.x + (TILE_SIZE - draggedPiece.width) / 2;
                    var y = mouse.y + (TILE_SIZE - draggedPiece.height) / 2;

                    // Locate the empty board tile beneath every piece tile.
                    draggedPiece.tiles.forEach(function(pieceTile) {
                        pieceTile.boardTile = this.board.tiles.find(function(boardTile) {
                            return !boardTile.piece &&
                                boardTile.isUnder(x + pieceTile.column * TILE_SIZE,
                                    y + pieceTile.row * TILE_SIZE);
                        });
                    }, this);

                    // Is every piece tile above a board tile?
                    if (draggedPiece.tiles.every(function(tile) {
                            return tile.boardTile;
                        })) {
                        // Set a reference to the piece on every board tile beneath it.
                        draggedPiece.tiles.forEach(function(tile) { tile.boardTile.piece = draggedPiece; });

                        // Center piece over the area on which it fits into the board.
                        var tile = draggedPiece.tiles[0];
                        draggedPiece.target = new PVector(tile.boardTile.left - tile.column * TILE_SIZE + draggedPiece.width / 2,
                            tile.boardTile.top - tile.row * TILE_SIZE + draggedPiece.height / 2);

                        // Do all board tiles contain a piece?  I.e., has the puzzle just been solved?
                        if (this.board.tiles.every(function(tile) {
                                return tile.piece;
                            })) {
                            console.log("success");

                        }
                    } else {
                        // Cancel drag; send piece back to tray.
                        draggedPiece.target = draggedPiece.coaster;
                    }

                    draggedPiece = draggedPiece.isLockedToMouse = false;
                };

                Puzzle.prototype._coasters = [ // Locations in the tray where each piece is hosted
                    [], // placeholder for 0 pieces
                    [new Coaster(200, 500)], // center coordinates
                    // [new Coaster(104, 500), new Coaster(200, 500), new Coaster(296, 500)],
                ]; // Locations in the tray where each piece is hosted

                Puzzle.prototype.draw = function() {

                    // Tray.

                    if (!mouse.isLocked && !draggedPiece) {

                        //不要删除
                        this.tray.forEach(this._drawCoaster);
                    }

                    this.board.draw();
                    this.pieces.forEach(this._updatePiece);
                    this.pieces.sort(this._sortPieces).forEach(this._drawPiece);


                };

                Puzzle.prototype._drawCoaster = function(coaster) {
                    // Does the coaster host a piece -AND- is the mouse over the coaster?
                    if (coaster.piece && mouse.isInRect(coaster.point.x - 40, coaster.point.y - 40, 80, 80)) {
                        cursor(HAND);

                        // Start drag?
                        if (mouse.isPressed && mouseButton === LEFT) {
                            (draggedPiece = coaster.piece).target = mouse;
                            // coaster.piece = false;
                        }
                    }
                };

                Puzzle.prototype._updatePiece = function(piece) {
                    piece.update();
                };

                Puzzle.prototype._sortPieces = function(a, b) {
                    // return b.zOrder - a.zOrder;
                };

                Puzzle.prototype._drawPiece = function(piece) {
                    piece.draw();
                };


                cache.load = (function() {
                    var _step = 1;
                    var _nextI = 0;
                    var _isLoaded = false;
                    var _targetTime = 1000 / 45; // targetFPS = the Splash screen's FPS of 45

                    randomSeed((hour() * 60 + minute()) * 60 + second());

                    Object.defineProperties(cache, {
                        isLoaded: {
                            get: function() {
                                return _isLoaded;
                            }
                        }
                    });

                    return function() {
                        var starting = system.time,
                            timePer,
                            debugId = _step;

                        switch (_step) {
                            case 1:
                                do {
                                    // timePer = millis();
                                    puzzles.push(new Puzzle(_nextI));
                                } while (++_nextI < maps.length && (millis() * 2 - starting - timePer < _targetTime));

                                break;

                        }
                    };
                })();

                var sceneSlider = (function() { // Handle scene transitions
                    var _direction = false;
                    var _image;
                    var _startTime;
                    var _endTime;

                    return {
                        start: function(direction) { // only LEFT, RIGHT, and DOWN are supported
                            _direction = direction;
                            _image = get(0, 0, width, height);
                            _endTime = (_startTime = system.time) + 500; // 1/2 second transition
                        },

                        draw: function() {
                            if (_direction) {
                                // Done?
                                if (_endTime <= system.time) {
                                    _direction = _image = mouse.isLocked = false;
                                }
                            }
                        }
                    };
                })(); // Handle scene transitions

                var scenePlay = function() {
                    if (system.frames === 1) {
                        (puzzle = puzzles[system.sceneInfo]).reset();
                    }

                    background(229, 173, 110);
                    // sceneSlider.draw();
                    puzzle.draw();

                };



                var sceneSplash = function() {
                    system.changeScene('play', 0);

                };

                mousePressed = function() {
                    mouse.isPressed = !mouse.isLocked;
                };

                mouseReleased = function() {
                    mouse.isPressed = false;
                    if (draggedPiece) {
                        puzzle.releaseDraggedPiece();
                    } else {
                        // mouse.isClicked = !mouse.isLocked;
                    }
                };



                draw = function() {
                    system.initializeFrame();

                    switch (system.scene) {
                        case 'play':
                            scenePlay();
                            break;

                        case 'splash':
                            cache.load();
                            sceneSplash();
                            break;
                    }

                };
            } // Processing.JS events



        if (typeof draw !== 'undefined') processing.draw = draw;
    });

    //do work
});
