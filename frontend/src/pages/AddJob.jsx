import api from "../api";
import JobForm from "../components/JobForm";
import { emptyJob } from "../constants";

function AddJob() {
    const addJob = (values) => api.post("/jobs", values);

    return (
        <JobForm
            title="Add Job Application"
            subtitle="Add a new job to your application tracker"
            submitLabel="Add Job"
            initialValues={emptyJob()}
            onSubmit={addJob}
        />
    );
}

export default AddJob;
