export class DynamicLayoutManager {
  constructor(targetContainer) {
    this.targetContainer = targetContainer;
    this.allElements = [];
    this.flexRows = [];
    this.isMobile = window.innerWidth <= 458; // Common mobile breakpoint
    this.originalStyles = new Map(); // Store original styles for restoration
  }

  /**
   * Initialize the layout manager by analyzing the target container.
   */
  initialize() {
    this.allElements = this._getAllPositionedElements(this.targetContainer);
    this.flexRows = this._groupIntoFlexRows(this.allElements);
    this._setupResizeObserver();
  }

  /**
   * Convert the layout of the target container to a dynamic layout (flexbox).
   */
  convertToDynamicLayout() {
    this._clearContainer();
    this._applyFlexLayout();
  }

  /**
   * Private method: Get all positioned elements within the target container.
   */
  _getAllPositionedElements(container) {
    const allChildNodes = Array.from(container.children);

    return allChildNodes.map((element) => {
      // Store original styles for restoration
      this.originalStyles.set(element, {
        position: element.style.position,
        width: element.style.width,
        height: element.style.height,
        margin: element.style.margin,
        display: element.style.display,
      });

      const rect = element.getBoundingClientRect();
      return {
        element,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        originalWidth: element.style.width || `${rect.width}px`,
        originalHeight: element.style.height || `${rect.height}px`,
      };
    });
  }

  /**
   * Private method: Group elements into rows based on their vertical positions.
   */
  _groupIntoFlexRows(elements) {
    elements.sort((a, b) => a.top - b.top);

    const rows = [];
    let currentRow = [elements[0]];

    for (let i = 1; i < elements.length; i++) {
      const prevElement = elements[i - 1];
      const currentElement = elements[i];

      // More aggressive grouping for mobile to create vertical layout
      const tolerance = this.isMobile ? 20 : 10;
      if (currentElement.top < prevElement.bottom + tolerance) {
        currentRow.push(currentElement);
      } else {
        rows.push({
          elements: currentRow.sort((a, b) => a.left - b.left),
          top: Math.min(...currentRow.map((el) => el.top)),
          bottom: Math.max(...currentRow.map((el) => el.bottom)),
        });
        currentRow = [currentElement];
      }
    }

    rows.push({
      elements: currentRow.sort((a, b) => a.left - b.left),
      top: Math.min(...currentRow.map((el) => el.top)),
      bottom: Math.max(...currentRow.map((el) => el.bottom)),
    });

    return rows;
  }

  /**
   * Private method: Clear the container's content and reset its styles.
   */
  _clearContainer() {
    this.targetContainer.innerHTML = "";
    this.targetContainer.style.display = "flex";
    this.targetContainer.style.flexDirection = "column";
    this.targetContainer.style.gap = this.isMobile ? "8px" : "10px";
    this.targetContainer.style.alignItems = "flex-start";
    this.targetContainer.style.width = "100%";
    this.targetContainer.style.overflowX = "hidden"; // Prevent horizontal scrolling
  }

  /**
   * Private method: Apply flexbox layout to the container.
   */
  _applyFlexLayout() {
    this.flexRows.forEach((row, rowIndex) => {
      const rowDiv = document.createElement("div");
      rowDiv.style.display = "flex";
      rowDiv.style.alignItems = "flex-start";

      // Mobile-specific adjustments
      if (this.isMobile) {
        rowDiv.style.flexDirection = "column";
        rowDiv.style.width = "100%";
        rowDiv.style.gap = "8px";
      } else {
        rowDiv.style.flexWrap = "wrap";
        rowDiv.style.minWidth = "0";
        rowDiv.style.flexGrow = "1";

        const rowGap = this._calculateRowGap(row.elements);
        const rowLeftOffset = this._calculateRowLeftOffset(row.elements);
        rowDiv.style.paddingLeft = `${rowLeftOffset}px`;
        rowDiv.style.gap = `${rowGap}px`;
      }

      row.elements.forEach((positionedElement) => {
        const element = positionedElement.element;

        // Reset and apply styles
        element.style.position = "static";
        element.style.margin = "0";
        element.style.flexShrink = "0";

        // Mobile-specific element styling
        if (this.isMobile) {
          element.style.width = "100%";
          element.style.maxWidth = "100%";
          element.style.height = "auto"; // Maintain aspect ratio
          element.style.aspectRatio = `${positionedElement.width}/${positionedElement.height}`;
        } else {
          element.style.width = positionedElement.originalWidth;
          element.style.height = positionedElement.originalHeight;
          element.style.minWidth = "0";

          const marginTop = this._calculateElementMarginTop(
            row.elements,
            positionedElement
          );
          element.style.marginTop = `${marginTop}px`;
        }

        rowDiv.appendChild(element);
      });

      // Vertical gap between rows
      if (rowIndex > 0) {
        const previousRow = this.flexRows[rowIndex - 1];
        const verticalGap = this._calculateVerticalGap(previousRow, row);
        rowDiv.style.marginTop = `${
          this.isMobile ? Math.min(verticalGap, 16) : verticalGap
        }px`;
      }

      this.targetContainer.appendChild(rowDiv);
    });
  }

  /**
   * Private method: Setup resize observer for responsive behavior.
   */
  _setupResizeObserver() {
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const newIsMobile = entry.contentRect.width <= 450;
        if (newIsMobile !== this.isMobile) {
          this.isMobile = newIsMobile;
          this.convertToDynamicLayout(); // Reapply layout when crossing breakpoint
        }
      }
    });

    resizeObserver.observe(this.targetContainer);
  }

  /**
   * Private method: Calculate the gap between elements in a row.
   */
  _calculateRowGap(elements) {
    let totalGap = 0;
    let gapCount = 0;

    for (let i = 1; i < elements.length; i++) {
      const gap = elements[i].left - elements[i - 1].right;
      if (gap > 0) {
        totalGap += gap;
        gapCount++;
      }
    }

    return gapCount > 0 ? Math.round(totalGap / gapCount) : 10;
  }

  /**
   * Private method: Calculate the top margin for an element in a row.
   */
  _calculateElementMarginTop(elements, positionedElement) {
    const rowTop = Math.min(...elements.map((el) => el.top));
    return positionedElement.top - rowTop;
  }

  /**
   * Private method: Calculate the left offset of a row.
   */
  _calculateRowLeftOffset(elements) {
    const firstElement = elements[0];
    const containerRect = this.targetContainer.getBoundingClientRect();
    return firstElement.left - containerRect.left;
  }

  /**
   * Private method: Calculate the vertical gap between two rows.
   */
  _calculateVerticalGap(previousRow, currentRow) {
    const previousRowBottom = Math.max(
      ...previousRow.elements.map((el) => el.bottom)
    );
    const currentRowTop = Math.min(...currentRow.elements.map((el) => el.top));
    return currentRowTop - previousRowBottom;
  }

  /**
   * Reset the layout to its original state.
   */
  resetLayout() {
    this.targetContainer.innerHTML = "";
    this.allElements.forEach(({ element }) => {
      const originalStyle = this.originalStyles.get(element);
      if (originalStyle) {
        Object.assign(element.style, originalStyle);
      }
      this.targetContainer.appendChild(element);
    });
  }
}
