import uuid

from pydantic import BaseModel, ConfigDict


class PublicJobSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    overview: str | None
    applicant_count: int


class PublicBoardResponse(BaseModel):
    org_name: str
    jobs: list[PublicJobSummary]


class PublicScreeningQuestionOut(BaseModel):
    # Deliberately no expected_answer — never sent to the public form.
    id: uuid.UUID
    question_text: str
    position: int


class PublicJobDetail(BaseModel):
    id: uuid.UUID
    title: str
    overview: str | None
    description: str | None
    is_technical_role: bool
    applicant_count: int
    screening_questions: list[PublicScreeningQuestionOut]
    # Frontend route back to the board this job came from — /careers/public
    # for the Freelance Org, /careers/{slug} for an Org tenant. Lets the
    # post-apply "browse other jobs" link go back to the right board
    # instead of guessing.
    board_path: str


class ApplyResponse(BaseModel):
    eligible: bool
    message: str
