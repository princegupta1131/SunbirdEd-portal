import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import * as _ from "lodash-es";

@Component({
  selector: "app-pd-filters",
  templateUrl: "./pd-filters.component.html"
})
export class PdFiltersComponent implements OnInit {
  @Input() pdFilter: any;
  @Output() filterChanged = new EventEmitter();
  pdFiltersFormGroup: FormGroup;

  constructor(public fb: FormBuilder) {}

  ngOnInit(): void {
    this.generateForm();
  }

  generateForm() {
    this.pdFiltersFormGroup = this.fb.group({});
    this.pdFiltersFormGroup.addControl(
      _.get(this.pdFilter, "reference"),
      this.fb.control("")
    );
  }

  inputChange() {
    this.filterChanged.emit(this.pdFiltersFormGroup.value);
  }
}