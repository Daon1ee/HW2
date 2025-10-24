let xPos = 0;

function setup() {
    createCanvas(300, 300);
    background(0);
}


function draw() {
    xPos = int(map(sin(counter * 0.2), -1, 1, 0 , width));
    counter++;
    background(0);
    fill(255);
    ellipse(xPos, height/2, 50, 50);
}