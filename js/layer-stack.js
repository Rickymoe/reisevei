function getLayerStack() {
  let stack = document.getElementById('layer-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'layer-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

// order: lower sits higher in the stack. overlay (status pill / switch) opens above its button.
function addLayerItem(order, button, overlay) {
  const item = document.createElement('div');
  item.className = 'layer-item';
  item.style.order = order;
  if (overlay) item.appendChild(overlay);
  item.appendChild(button);
  getLayerStack().appendChild(item);
}
