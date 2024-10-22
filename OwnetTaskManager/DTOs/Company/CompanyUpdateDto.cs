using System.ComponentModel.DataAnnotations;

namespace OwnetTaskManager.DTOs.Company
{
    public class CompanyUpdateDto
    {
        [Required(ErrorMessage = "The name is required")]
        [StringLength(100, ErrorMessage = "The name cannot exceed 100 characters")]
        public string Name { get; set; }

        [Phone(ErrorMessage = "Invalid phone number")]
        [StringLength(15, ErrorMessage = "The phone number cannot exceed 15 characters")]
        public string Phone { get; set; }

        [EmailAddress(ErrorMessage = "Invalid email address")]
        public string Email { get; set; }

        [Url(ErrorMessage = "Invalid website URL")]
        public string Website { get; set; }

        public string Logo { get; set; }

        [Required(ErrorMessage = "The status is required")]
        public string Status { get; set; }
    }
}